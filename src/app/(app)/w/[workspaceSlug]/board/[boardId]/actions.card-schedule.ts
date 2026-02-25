"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { APP_ROUTES } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { boardPathSchema } from "./actions.card-richness.shared";
import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { boardRoute, logBoardActivity, resolveBoardAccess, withBoardError } from "./actions.shared";

const updateCardScheduleSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  dueAtIso: z.string().max(64).optional(),
  hasDueTime: z.enum(["false", "true"]).optional(),
  hasStartTime: z.enum(["false", "true"]).optional(),
  recurrenceRRule: z.string().max(512).optional(),
  recurrenceTz: z.string().max(64).optional(),
  reminderOffsetMinutes: z.string().max(16).optional(),
  startAtIso: z.string().max(64).optional(),
});

type CardSchedulePayload = {
  boardId: string;
  cardId: string;
  dueAtIso: string | null;
  hasDueTime: boolean;
  hasStartTime: boolean;
  recurrenceRRule: string | null;
  recurrenceTz: string | null;
  reminderOffsetMinutes: number | null;
  startAtIso: string | null;
  workspaceSlug: string;
};

type CardSchedulePersistResult =
  | { ok: true; boardId: string; workspaceSlug: string }
  | { boardId: string; error: string; ok: false; workspaceSlug: string };
type CardScheduleInlineMutationResult =
  | { ok: true }
  | { error: string; ok: false };

const legacyDueDateSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  dueAt: z.string().max(64).optional(),
});

function parseDateInput(
  value: string | undefined,
): { invalid: boolean; value: string | null } {
  if (!value || value.trim().length === 0) {
    return { invalid: false, value: null };
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return { invalid: true, value: null };
  }

  return { invalid: false, value: parsedDate.toISOString() };
}

function parseBooleanInput(value: string | undefined, fallbackValue: boolean): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallbackValue;
}

function parseReminderOffsetInput(
  value: string | undefined,
): { invalid: boolean; value: number | null } {
  const trimmedValue = value?.trim() ?? "";
  if (trimmedValue.length < 1) {
    return { invalid: false, value: null };
  }

  const parsedValue = Number.parseInt(trimmedValue, 10);
  if (
    Number.isNaN(parsedValue) ||
    !Number.isFinite(parsedValue) ||
    parsedValue < -43200 ||
    parsedValue > 0
  ) {
    return { invalid: true, value: null };
  }

  return { invalid: false, value: parsedValue };
}

function parseRecurrenceRuleInput(
  value: string | undefined,
): { invalid: boolean; value: string | null } {
  const trimmedValue = value?.trim() ?? "";
  if (trimmedValue.length < 1) {
    return { invalid: false, value: null };
  }

  const normalized = trimmedValue.toUpperCase();
  const isValidShape = /^([A-Z_]+=[^;]+)(;[A-Z_]+=[^;]+)*$/.test(normalized);
  if (!isValidShape || !normalized.includes("FREQ=")) {
    return { invalid: true, value: null };
  }

  return { invalid: false, value: normalized };
}

function parseTimezoneInput(value: string | undefined): string | null {
  const trimmedValue = value?.trim() ?? "";
  if (trimmedValue.length < 1) {
    return null;
  }

  if (trimmedValue.length > 64) {
    return null;
  }

  if (typeof Intl.supportedValuesOf === "function") {
    const knownTimezones = Intl.supportedValuesOf("timeZone");
    if (!knownTimezones.includes(trimmedValue)) {
      return null;
    }
  }

  return trimmedValue;
}

async function resolveUserTimezone(userId: string): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.timezone || data.timezone.trim().length < 1) {
    return "UTC";
  }

  if (typeof Intl.supportedValuesOf === "function") {
    const knownTimezones = Intl.supportedValuesOf("timeZone");
    if (!knownTimezones.includes(data.timezone)) {
      return "UTC";
    }
  }

  return data.timezone;
}

function parseUpdateCardScheduleFormData(formData: FormData) {
  return updateCardScheduleSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    dueAtIso: formData.get("dueAtIso"),
    hasDueTime: formData.get("hasDueTime"),
    hasStartTime: formData.get("hasStartTime"),
    recurrenceRRule: formData.get("recurrenceRRule"),
    recurrenceTz: formData.get("recurrenceTz"),
    reminderOffsetMinutes: formData.get("reminderOffsetMinutes"),
    startAtIso: formData.get("startAtIso"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

async function persistCardSchedule(
  payload: CardSchedulePayload,
): Promise<CardSchedulePersistResult> {
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  const startAtDate = payload.startAtIso ? new Date(payload.startAtIso) : null;
  const dueAtDate = payload.dueAtIso ? new Date(payload.dueAtIso) : null;
  if (startAtDate && dueAtDate && startAtDate.getTime() > dueAtDate.getTime()) {
    return {
      boardId: payload.boardId,
      error: "Start date must be before due date.",
      ok: false,
      workspaceSlug: payload.workspaceSlug,
    };
  }

  if (!payload.dueAtIso && payload.reminderOffsetMinutes !== null) {
    return {
      boardId: payload.boardId,
      error: "Reminder requires a due date.",
      ok: false,
      workspaceSlug: payload.workspaceSlug,
    };
  }

  if (payload.recurrenceRRule && !payload.dueAtIso && !payload.startAtIso) {
    return {
      boardId: payload.boardId,
      error: "Recurring rule requires a start or due date.",
      ok: false,
      workspaceSlug: payload.workspaceSlug,
    };
  }

  const profileTimezone = await resolveUserTimezone(access.userId);
  const recurrenceTimezone = payload.recurrenceRRule
    ? (payload.recurrenceTz ?? profileTimezone)
    : null;
  const recurrenceAnchorAt = payload.recurrenceRRule
    ? (payload.dueAtIso ?? payload.startAtIso)
    : null;
  const supabase = await createServerSupabaseClient();
  const { data: updatedCard, error } = await supabase
    .from("cards")
    .update({
      due_at: payload.dueAtIso,
      has_due_time: payload.dueAtIso ? payload.hasDueTime : false,
      has_start_time: payload.startAtIso ? payload.hasStartTime : false,
      recurrence_anchor_at: recurrenceAnchorAt,
      recurrence_rrule: payload.recurrenceRRule,
      recurrence_tz: recurrenceTimezone,
      reminder_offset_minutes: payload.dueAtIso ? payload.reminderOffsetMinutes : null,
      start_at: payload.startAtIso,
    })
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !updatedCard) {
    return {
      boardId: payload.boardId,
      error: error?.message ?? "Failed to update card schedule.",
      ok: false,
      workspaceSlug: payload.workspaceSlug,
    };
  }

  await logBoardActivity({
    action: "schedule.update",
    boardId: payload.boardId,
    entityId: payload.cardId,
    entityType: "card",
    metadata: {
      dueAt: payload.dueAtIso,
      recurrenceRRule: payload.recurrenceRRule,
      recurrenceTz: recurrenceTimezone,
      reminderOffsetMinutes: payload.reminderOffsetMinutes,
      startAt: payload.startAtIso,
    },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(payload.workspaceSlug, payload.boardId));
  return {
    boardId: payload.boardId,
    ok: true,
    workspaceSlug: payload.workspaceSlug,
  };
}

export async function updateCardSchedule(formData: FormData) {
  const parsed = parseUpdateCardScheduleFormData(formData);
  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const dueAtInput = parseDateInput(parsed.data.dueAtIso);
  const startAtInput = parseDateInput(parsed.data.startAtIso);
  if (dueAtInput.invalid || startAtInput.invalid) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, "Invalid schedule date format."));
  }

  const reminderOffset = parseReminderOffsetInput(parsed.data.reminderOffsetMinutes);
  if (reminderOffset.invalid) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, "Invalid reminder offset."));
  }

  const recurrenceRule = parseRecurrenceRuleInput(parsed.data.recurrenceRRule);
  if (recurrenceRule.invalid) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, "Invalid recurrence rule."));
  }

  const persistResult = await persistCardSchedule({
    boardId: parsed.data.boardId,
    cardId: parsed.data.cardId,
    dueAtIso: dueAtInput.value,
    hasDueTime: parseBooleanInput(parsed.data.hasDueTime, true),
    hasStartTime: parseBooleanInput(parsed.data.hasStartTime, false),
    recurrenceRRule: recurrenceRule.value,
    recurrenceTz: parseTimezoneInput(parsed.data.recurrenceTz),
    reminderOffsetMinutes: reminderOffset.value,
    startAtIso: startAtInput.value,
    workspaceSlug: parsed.data.workspaceSlug,
  });
  if (!persistResult.ok) {
    redirect(
      withBoardError(
        persistResult.workspaceSlug,
        persistResult.boardId,
        persistResult.error,
      ),
    );
  }

  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function updateCardScheduleInline(
  formData: FormData,
): Promise<CardScheduleInlineMutationResult> {
  const parsed = parseUpdateCardScheduleFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid schedule payload.", ok: false };
  }

  const dueAtInput = parseDateInput(parsed.data.dueAtIso);
  const startAtInput = parseDateInput(parsed.data.startAtIso);
  if (dueAtInput.invalid || startAtInput.invalid) {
    return { error: "Invalid schedule date format.", ok: false };
  }

  const reminderOffset = parseReminderOffsetInput(parsed.data.reminderOffsetMinutes);
  if (reminderOffset.invalid) {
    return { error: "Invalid reminder offset.", ok: false };
  }

  const recurrenceRule = parseRecurrenceRuleInput(parsed.data.recurrenceRRule);
  if (recurrenceRule.invalid) {
    return { error: "Invalid recurrence rule.", ok: false };
  }

  try {
    const persistResult = await persistCardSchedule({
      boardId: parsed.data.boardId,
      cardId: parsed.data.cardId,
      dueAtIso: dueAtInput.value,
      hasDueTime: parseBooleanInput(parsed.data.hasDueTime, true),
      hasStartTime: parseBooleanInput(parsed.data.hasStartTime, false),
      recurrenceRRule: recurrenceRule.value,
      recurrenceTz: parseTimezoneInput(parsed.data.recurrenceTz),
      reminderOffsetMinutes: reminderOffset.value,
      startAtIso: startAtInput.value,
      workspaceSlug: parsed.data.workspaceSlug,
    });
    if (!persistResult.ok) {
      return { error: persistResult.error, ok: false };
    }
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, "Failed to update card schedule."),
      ok: false,
    };
  }

  return { ok: true };
}

export async function updateCardDueDate(formData: FormData) {
  const dueAtField = formData.get("dueAt");
  const parsed = legacyDueDateSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    dueAt: typeof dueAtField === "string" ? dueAtField : undefined,
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const dueAtInput = parseDateInput(parsed.data.dueAt);
  if (dueAtInput.invalid) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, "Invalid due date format."));
  }

  const persistResult = await persistCardSchedule({
    boardId: parsed.data.boardId,
    cardId: parsed.data.cardId,
    dueAtIso: dueAtInput.value,
    hasDueTime: true,
    hasStartTime: false,
    recurrenceRRule: null,
    recurrenceTz: null,
    reminderOffsetMinutes: null,
    startAtIso: null,
    workspaceSlug: parsed.data.workspaceSlug,
  });
  if (!persistResult.ok) {
    redirect(
      withBoardError(
        persistResult.workspaceSlug,
        persistResult.boardId,
        persistResult.error,
      ),
    );
  }

  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function updateCardDueDateInline(
  formData: FormData,
): Promise<CardScheduleInlineMutationResult> {
  const dueAtField = formData.get("dueAt");
  const parsed = legacyDueDateSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    dueAt: typeof dueAtField === "string" ? dueAtField : undefined,
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    return { error: "Invalid due date payload.", ok: false };
  }

  const dueAtInput = parseDateInput(parsed.data.dueAt);
  if (dueAtInput.invalid) {
    return { error: "Invalid due date format.", ok: false };
  }

  try {
    const persistResult = await persistCardSchedule({
      boardId: parsed.data.boardId,
      cardId: parsed.data.cardId,
      dueAtIso: dueAtInput.value,
      hasDueTime: true,
      hasStartTime: false,
      recurrenceRRule: null,
      recurrenceTz: null,
      reminderOffsetMinutes: null,
      startAtIso: null,
      workspaceSlug: parsed.data.workspaceSlug,
    });
    if (!persistResult.ok) {
      return { error: persistResult.error, ok: false };
    }
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, "Failed to update due date."),
      ok: false,
    };
  }

  return { ok: true };
}
