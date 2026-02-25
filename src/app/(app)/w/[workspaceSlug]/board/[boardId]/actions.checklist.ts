"use server";
/* eslint-disable max-lines */

import { sanitizeUserText } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { logBoardActivity, resolveBoardAccess } from "./actions.shared";
import {
  createChecklistItemSchema,
  createChecklistSchema,
  deleteChecklistItemSchema,
  deleteChecklistSchema,
  ensureActiveCard,
  ensureActiveChecklist,
  ensureActiveChecklistItem,
  reorderChecklistItemsSchema,
  reorderChecklistsSchema,
  revalidateBoardPath,
  toggleChecklistItemSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
} from "./actions.card-richness.shared";
import type { ChecklistItemRecord, ChecklistRecord } from "./types";
import { parseNumeric } from "./utils";

type ChecklistMutationResult =
  | {
      checklistCompletedCount: number;
      checklistTotalCount: number;
      checklists: ChecklistRecord[];
      ok: true;
    }
  | { error: string; ok: false };

type ChecklistItemRow = {
  body: string;
  checklist_id: string;
  id: string;
  is_done: boolean;
  position: number | string;
};

type ChecklistRow = {
  card_id: string;
  id: string;
  position: number | string;
  title: string;
};

function buildChecklistPayload(checklists: ChecklistRecord[]): ChecklistMutationResult {
  const items = checklists.flatMap((checklist) => checklist.items);
  const checklistCompletedCount = items.filter((item) => item.isDone).length;
  return {
    checklistCompletedCount,
    checklistTotalCount: items.length,
    checklists,
    ok: true,
  };
}

function parseBooleanEntry(value: FormDataEntryValue | null): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function parseOrderedIds(value: FormDataEntryValue | null): string[] | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const ids = parsed.filter((entry) => typeof entry === "string");
    return ids.length === parsed.length ? ids : null;
  } catch {
    return null;
  }
}

async function fetchChecklistsByCardId(cardId: string): Promise<ChecklistRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data: checklistData, error: checklistError } = await supabase
    .from("card_checklists")
    .select("id, card_id, title, position")
    .eq("card_id", cardId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (checklistError) {
    throw new Error(`Failed to load checklists: ${checklistError.message}`);
  }

  const checklists = (checklistData ?? []) as ChecklistRow[];
  if (checklists.length < 1) {
    return [];
  }

  const checklistIds = checklists.map((entry) => entry.id);
  const { data: itemData, error: itemError } = await supabase
    .from("card_checklist_items")
    .select("id, checklist_id, body, is_done, position")
    .in("checklist_id", checklistIds)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemError) {
    throw new Error(`Failed to load checklist items: ${itemError.message}`);
  }

  const itemRows = (itemData ?? []) as ChecklistItemRow[];
  const itemsByChecklistId = new Map<string, ChecklistItemRecord[]>();
  for (const row of itemRows) {
    const entries = itemsByChecklistId.get(row.checklist_id) ?? [];
    entries.push({
      body: row.body,
      checklistId: row.checklist_id,
      id: row.id,
      isDone: row.is_done,
      position: parseNumeric(row.position),
    });
    itemsByChecklistId.set(row.checklist_id, entries);
  }

  return checklists.map((row) => ({
    cardId: row.card_id,
    id: row.id,
    items: [...(itemsByChecklistId.get(row.id) ?? [])].sort((left, right) => left.position - right.position),
    position: parseNumeric(row.position),
    title: row.title,
  }));
}

async function findChecklistInBoard(params: {
  boardId: string;
  checklistId: string;
}): Promise<{ cardId: string; id: string } | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("card_checklists")
    .select("id, card_id, cards!inner(board_id)")
    .eq("id", params.checklistId)
    .eq("cards.board_id", params.boardId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve checklist: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return { cardId: data.card_id as string, id: data.id as string };
}

async function nextChecklistPosition(cardId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("card_checklists")
    .select("position")
    .eq("card_id", cardId)
    .order("position", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to resolve checklist order: ${error.message}`);
  }

  const tailPosition = parseNumeric((data?.[0]?.position ?? 0) as number | string);
  return tailPosition > 0 ? tailPosition + 1024 : 1024;
}

async function nextChecklistItemPosition(checklistId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("card_checklist_items")
    .select("position")
    .eq("checklist_id", checklistId)
    .order("position", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to resolve checklist item order: ${error.message}`);
  }

  const tailPosition = parseNumeric((data?.[0]?.position ?? 0) as number | string);
  return tailPosition > 0 ? tailPosition + 1024 : 1024;
}

async function reorderChecklistPositions(cardId: string, orderedChecklistIds: string[]): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("card_checklists")
    .select("id")
    .eq("card_id", cardId);

  if (error) {
    throw new Error(`Failed to validate checklist order: ${error.message}`);
  }

  const existingIds = new Set(((data ?? []) as Array<{ id: string }>).map((entry) => entry.id));
  if (existingIds.size !== orderedChecklistIds.length) {
    throw new Error("Checklist order payload does not match current checklists.");
  }

  for (const checklistId of orderedChecklistIds) {
    if (!existingIds.has(checklistId)) {
      throw new Error("Checklist order contains unknown checklist id.");
    }
  }

  await Promise.all(
    orderedChecklistIds.map(async (checklistId, index) => {
      const { error: updateError } = await supabase
        .from("card_checklists")
        .update({ position: (index + 1) * 1024 })
        .eq("id", checklistId)
        .eq("card_id", cardId);

      if (updateError) {
        throw new Error(`Failed to reorder checklist groups: ${updateError.message}`);
      }
    }),
  );
}

async function reorderChecklistItemPositions(checklistId: string, orderedItemIds: string[]): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("card_checklist_items")
    .select("id")
    .eq("checklist_id", checklistId);

  if (error) {
    throw new Error(`Failed to validate checklist item order: ${error.message}`);
  }

  const existingIds = new Set(((data ?? []) as Array<{ id: string }>).map((entry) => entry.id));
  if (existingIds.size !== orderedItemIds.length) {
    throw new Error("Checklist item order payload does not match current items.");
  }

  for (const itemId of orderedItemIds) {
    if (!existingIds.has(itemId)) {
      throw new Error("Checklist item order contains unknown item id.");
    }
  }

  await Promise.all(
    orderedItemIds.map(async (itemId, index) => {
      const { error: updateError } = await supabase
        .from("card_checklist_items")
        .update({ position: (index + 1) * 1024 })
        .eq("id", itemId)
        .eq("checklist_id", checklistId);

      if (updateError) {
        throw new Error(`Failed to reorder checklist items: ${updateError.message}`);
      }
    }),
  );
}

async function logChecklistActivity(payload: {
  action: string;
  boardId: string;
  cardId: string;
  metadata: Record<string, unknown>;
  userId: string;
  workspaceId: string;
}) {
  await logBoardActivity({
    action: payload.action,
    boardId: payload.boardId,
    entityId: payload.cardId,
    entityType: "card",
    metadata: payload.metadata,
    userId: payload.userId,
    workspaceId: payload.workspaceId,
  });
}

export async function createChecklistInline(formData: FormData): Promise<ChecklistMutationResult> {
  const parsed = createChecklistSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    title: formData.get("title"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    return { error: "Invalid checklist payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const sanitizedTitle = sanitizeUserText(parsed.data.title);
    if (sanitizedTitle.length < 1 || sanitizedTitle.length > 120) {
      return { error: "Checklist title must be 1-120 characters.", ok: false };
    }

    const supabase = await createServerSupabaseClient();
    await ensureActiveCard(supabase, parsed.data.workspaceSlug, parsed.data.boardId, parsed.data.cardId);
    const position = await nextChecklistPosition(parsed.data.cardId);
    const { data, error } = await supabase
      .from("card_checklists")
      .insert({
        card_id: parsed.data.cardId,
        created_by: access.userId,
        position,
        title: sanitizedTitle,
      })
      .select("id")
      .single();

    if (!data || error) {
      throw new Error(error?.message ?? "Failed to create checklist.");
    }

    await logChecklistActivity({
      action: "checklist.group.create",
      boardId: parsed.data.boardId,
      cardId: parsed.data.cardId,
      metadata: { checklistId: data.id },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return buildChecklistPayload(await fetchChecklistsByCardId(parsed.data.cardId));
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to create checklist."), ok: false };
  }
}

export async function updateChecklistInline(formData: FormData): Promise<ChecklistMutationResult> {
  const parsed = updateChecklistSchema.safeParse({
    boardId: formData.get("boardId"),
    checklistId: formData.get("checklistId"),
    title: formData.get("title"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    return { error: "Invalid checklist update payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const sanitizedTitle = sanitizeUserText(parsed.data.title);
    if (sanitizedTitle.length < 1 || sanitizedTitle.length > 120) {
      return { error: "Checklist title must be 1-120 characters.", ok: false };
    }

    const checklist = await findChecklistInBoard({
      boardId: parsed.data.boardId,
      checklistId: parsed.data.checklistId,
    });
    if (!checklist) {
      return { error: "Checklist not found.", ok: false };
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("card_checklists")
      .update({ title: sanitizedTitle })
      .eq("id", checklist.id);

    if (error) {
      throw new Error(error.message);
    }

    await logChecklistActivity({
      action: "checklist.group.rename",
      boardId: parsed.data.boardId,
      cardId: checklist.cardId,
      metadata: { checklistId: checklist.id },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return buildChecklistPayload(await fetchChecklistsByCardId(checklist.cardId));
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to update checklist."), ok: false };
  }
}

export async function deleteChecklistInline(formData: FormData): Promise<ChecklistMutationResult> {
  const parsed = deleteChecklistSchema.safeParse({
    boardId: formData.get("boardId"),
    checklistId: formData.get("checklistId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    return { error: "Invalid checklist delete payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const checklist = await findChecklistInBoard({
      boardId: parsed.data.boardId,
      checklistId: parsed.data.checklistId,
    });
    if (!checklist) {
      return { error: "Checklist not found.", ok: false };
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("card_checklists")
      .delete()
      .eq("id", checklist.id);

    if (error) {
      throw new Error(error.message);
    }

    await logChecklistActivity({
      action: "checklist.group.delete",
      boardId: parsed.data.boardId,
      cardId: checklist.cardId,
      metadata: { checklistId: checklist.id },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return buildChecklistPayload(await fetchChecklistsByCardId(checklist.cardId));
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to delete checklist."), ok: false };
  }
}

export async function reorderChecklistsInline(formData: FormData): Promise<ChecklistMutationResult> {
  const orderedChecklistIds = parseOrderedIds(formData.get("orderedChecklistIds"));
  const parsed = reorderChecklistsSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    orderedChecklistIds: orderedChecklistIds ?? [],
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    return { error: "Invalid checklist reorder payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    await ensureActiveCard(supabase, parsed.data.workspaceSlug, parsed.data.boardId, parsed.data.cardId);
    await reorderChecklistPositions(parsed.data.cardId, parsed.data.orderedChecklistIds);

    await logChecklistActivity({
      action: "checklist.group.reorder",
      boardId: parsed.data.boardId,
      cardId: parsed.data.cardId,
      metadata: { orderedChecklistIds: parsed.data.orderedChecklistIds },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return buildChecklistPayload(await fetchChecklistsByCardId(parsed.data.cardId));
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to reorder checklists."), ok: false };
  }
}

export async function createChecklistItemInline(formData: FormData): Promise<ChecklistMutationResult> {
  const parsed = createChecklistItemSchema.safeParse({
    boardId: formData.get("boardId"),
    body: formData.get("body"),
    checklistId: formData.get("checklistId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    return { error: "Invalid checklist item payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const sanitizedBody = sanitizeUserText(parsed.data.body);
    if (sanitizedBody.length < 1 || sanitizedBody.length > 500) {
      return { error: "Checklist item text must be 1-500 characters.", ok: false };
    }

    const supabase = await createServerSupabaseClient();
    const checklist = await ensureActiveChecklist(
      supabase,
      parsed.data.workspaceSlug,
      parsed.data.boardId,
      parsed.data.checklistId,
    );
    const position = await nextChecklistItemPosition(checklist.id);
    const { data, error } = await supabase
      .from("card_checklist_items")
      .insert({
        body: sanitizedBody,
        checklist_id: checklist.id,
        created_by: access.userId,
        position,
      })
      .select("id")
      .single();

    if (!data || error) {
      throw new Error(error?.message ?? "Failed to create checklist item.");
    }

    await logChecklistActivity({
      action: "checklist.item.create",
      boardId: parsed.data.boardId,
      cardId: checklist.cardId,
      metadata: { checklistId: checklist.id, checklistItemId: data.id },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return buildChecklistPayload(await fetchChecklistsByCardId(checklist.cardId));
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to create checklist item."), ok: false };
  }
}

export async function updateChecklistItemInline(formData: FormData): Promise<ChecklistMutationResult> {
  const parsed = updateChecklistItemSchema.safeParse({
    boardId: formData.get("boardId"),
    body: formData.get("body"),
    checklistItemId: formData.get("checklistItemId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    return { error: "Invalid checklist update payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const sanitizedBody = sanitizeUserText(parsed.data.body);
    if (sanitizedBody.length < 1 || sanitizedBody.length > 500) {
      return { error: "Checklist item text must be 1-500 characters.", ok: false };
    }

    const supabase = await createServerSupabaseClient();
    const checklistItem = await ensureActiveChecklistItem(
      supabase,
      parsed.data.workspaceSlug,
      parsed.data.boardId,
      parsed.data.checklistItemId,
    );
    const { error } = await supabase
      .from("card_checklist_items")
      .update({ body: sanitizedBody })
      .eq("id", checklistItem.id);

    if (error) {
      throw new Error(error.message);
    }

    await logChecklistActivity({
      action: "checklist.item.update",
      boardId: parsed.data.boardId,
      cardId: checklistItem.cardId,
      metadata: { checklistId: checklistItem.checklistId, checklistItemId: checklistItem.id },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return buildChecklistPayload(await fetchChecklistsByCardId(checklistItem.cardId));
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to update checklist item."), ok: false };
  }
}

export async function toggleChecklistItemInline(formData: FormData): Promise<ChecklistMutationResult> {
  const workspaceSlug = formData.get("workspaceSlug");
  const isDone = parseBooleanEntry(formData.get("isDone"));
  const parsed = toggleChecklistItemSchema.safeParse({
    boardId: formData.get("boardId"),
    checklistItemId: formData.get("checklistItemId"),
    isDone: isDone ?? false,
    workspaceSlug,
  });

  if (!parsed.success || typeof workspaceSlug !== "string" || isDone === null) {
    return { error: "Invalid checklist toggle payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    const checklistItem = await ensureActiveChecklistItem(
      supabase,
      workspaceSlug,
      parsed.data.boardId,
      parsed.data.checklistItemId,
    );
    const { error } = await supabase
      .from("card_checklist_items")
      .update({ is_done: isDone })
      .eq("id", checklistItem.id);

    if (error) {
      throw new Error(error.message);
    }

    await logChecklistActivity({
      action: isDone ? "checklist.item.complete" : "checklist.item.reopen",
      boardId: parsed.data.boardId,
      cardId: checklistItem.cardId,
      metadata: { checklistId: checklistItem.checklistId, checklistItemId: checklistItem.id, isDone },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(workspaceSlug, parsed.data.boardId);
    return buildChecklistPayload(await fetchChecklistsByCardId(checklistItem.cardId));
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to toggle checklist item."), ok: false };
  }
}

export async function deleteChecklistItemInline(formData: FormData): Promise<ChecklistMutationResult> {
  const workspaceSlug = formData.get("workspaceSlug");
  const parsed = deleteChecklistItemSchema.safeParse({
    boardId: formData.get("boardId"),
    checklistItemId: formData.get("checklistItemId"),
    workspaceSlug,
  });

  if (!parsed.success || typeof workspaceSlug !== "string") {
    return { error: "Invalid checklist delete payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    const checklistItem = await ensureActiveChecklistItem(
      supabase,
      workspaceSlug,
      parsed.data.boardId,
      parsed.data.checklistItemId,
    );
    const { error } = await supabase
      .from("card_checklist_items")
      .delete()
      .eq("id", checklistItem.id);

    if (error) {
      throw new Error(error.message);
    }

    await logChecklistActivity({
      action: "checklist.item.delete",
      boardId: parsed.data.boardId,
      cardId: checklistItem.cardId,
      metadata: { checklistId: checklistItem.checklistId, checklistItemId: checklistItem.id },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(workspaceSlug, parsed.data.boardId);
    return buildChecklistPayload(await fetchChecklistsByCardId(checklistItem.cardId));
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to delete checklist item."), ok: false };
  }
}

export async function reorderChecklistItemsInline(formData: FormData): Promise<ChecklistMutationResult> {
  const orderedItemIds = parseOrderedIds(formData.get("orderedItemIds"));
  const parsed = reorderChecklistItemsSchema.safeParse({
    boardId: formData.get("boardId"),
    checklistId: formData.get("checklistId"),
    orderedItemIds: orderedItemIds ?? [],
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    return { error: "Invalid checklist reorder payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    const checklist = await ensureActiveChecklist(
      supabase,
      parsed.data.workspaceSlug,
      parsed.data.boardId,
      parsed.data.checklistId,
    );
    await reorderChecklistItemPositions(checklist.id, parsed.data.orderedItemIds);

    await logChecklistActivity({
      action: "checklist.item.reorder",
      boardId: parsed.data.boardId,
      cardId: checklist.cardId,
      metadata: { checklistId: checklist.id, orderedItemIds: parsed.data.orderedItemIds },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return buildChecklistPayload(await fetchChecklistsByCardId(checklist.cardId));
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to reorder checklist items."), ok: false };
  }
}
