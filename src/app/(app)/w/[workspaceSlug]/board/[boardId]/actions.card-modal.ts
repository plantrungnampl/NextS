"use server";
/* eslint-disable max-lines */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { APP_ROUTES, sanitizeNullableUserText } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { ATTACHMENT_BUCKET, boardPathSchema } from "./actions.card-richness.shared";
import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { boardRoute, fetchCardsForBoard, logBoardActivity, resolveBoardAccess, withBoardError } from "./actions.shared";
import {
  updateCardDueDate as updateCardDueDateAction,
  updateCardDueDateInline as updateCardDueDateInlineAction,
  updateCardSchedule as updateCardScheduleAction,
  updateCardScheduleInline as updateCardScheduleInlineAction,
} from "./actions.card-schedule";
import { CARD_PRIORITY_VALUES, CARD_STATUS_VALUES } from "./card-custom-fields";
import type { BoardVisibility, WorkspaceRole } from "./types";
import { canWriteBoardByRole, resolveInsertPosition } from "./utils";

const updateCardDescriptionSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  description: z.string().max(5000).optional(),
});

const updateCardCustomFieldsSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  effort: z.string().max(120).optional(),
  priority: z.string().max(32).optional(),
  status: z.string().max(32).optional(),
});

const updateCardCompletionSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  isCompleted: z.enum(["true", "false"]),
});

const moveCardLegacySchema = boardPathSchema.extend({
  cardId: z.uuid(),
  listId: z.uuid(),
});

const moveCardWithDestinationSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  targetBoardId: z.uuid(),
  targetListId: z.uuid(),
  targetPositionIndex: z.coerce.number().int().min(1).max(10000),
});

const moveDestinationOptionsSchema = boardPathSchema.extend({
  cardId: z.uuid(),
});
const upsertPrivateInboxItemSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  targetPositionIndex: z.coerce.number().int().min(1).max(10000),
});

const deleteCardSchema = boardPathSchema.extend({
  cardId: z.uuid(),
});

type CardDescriptionPayload = z.infer<typeof updateCardDescriptionSchema>;

type CardDescriptionPersistResult =
  | { ok: true; boardId: string; workspaceSlug: string }
  | { boardId: string; error: string; ok: false; workspaceSlug: string };

type CardCustomFieldsPayload = z.infer<typeof updateCardCustomFieldsSchema>;

type CardCustomFieldsPersistResult =
  | { ok: true; boardId: string; workspaceSlug: string }
  | { boardId: string; error: string; ok: false; workspaceSlug: string };

type CardCompletionPayload = z.infer<typeof updateCardCompletionSchema>;

type CardCompletionPersistResult =
  | { ok: true; boardId: string; workspaceSlug: string }
  | { boardId: string; error: string; ok: false; workspaceSlug: string };

type MoveDestinationBoardOption = {
  id: string;
  name: string;
};
type MoveDestinationListOption = {
  cardCount: number;
  id: string;
  title: string;
};
type MoveDestinationOptions = {
  boards: MoveDestinationBoardOption[];
  currentBoardId: string;
  listsByBoard: Record<string, MoveDestinationListOption[]>;
  privateInboxPositionCount: number;
};
type MoveCardPayload = {
  boardId: string;
  cardId: string;
  targetBoardId: string;
  targetListId: string;
  targetPositionIndex: number;
  workspaceSlug: string;
};
type UpsertPrivateInboxPayload = {
  boardId: string;
  cardId: string;
  targetPositionIndex: number;
  workspaceSlug: string;
};

function parseEnumValue<EnumValue extends string>(
  rawValue: string | undefined,
  validValues: readonly EnumValue[],
): { invalid: boolean; value: EnumValue | null } {
  const trimmedValue = rawValue?.trim() ?? "";
  if (trimmedValue.length < 1) {
    return { invalid: false, value: null };
  }

  if (!validValues.includes(trimmedValue as EnumValue)) {
    return { invalid: true, value: null };
  }

  return { invalid: false, value: trimmedValue as EnumValue };
}

export async function updateCardSchedule(formData: FormData) {
  return updateCardScheduleAction(formData);
}

export async function updateCardDueDate(formData: FormData) {
  return updateCardDueDateAction(formData);
}

export async function updateCardScheduleInline(
  formData: FormData,
): Promise<{ error?: string; ok: boolean }> {
  return updateCardScheduleInlineAction(formData);
}

export async function updateCardDueDateInline(
  formData: FormData,
): Promise<{ error?: string; ok: boolean }> {
  return updateCardDueDateInlineAction(formData);
}

export async function updateCardDescription(formData: FormData) {
  const parsed = parseUpdateCardDescriptionFormData(formData);
  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const persistResult = await persistCardDescription(parsed.data);
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

export async function updateCardDescriptionInline(
  formData: FormData,
): Promise<{ error?: string; ok: boolean }> {
  const parsed = parseUpdateCardDescriptionFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid description payload.", ok: false };
  }

  const persistResult = await persistCardDescription(parsed.data);
  if (!persistResult.ok) {
    return { error: persistResult.error, ok: false };
  }

  return { ok: true };
}

function parseUpdateCardDescriptionFormData(formData: FormData) {
  const descriptionField = formData.get("description");
  return updateCardDescriptionSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    description: typeof descriptionField === "string" ? descriptionField : undefined,
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

async function persistCardDescription(
  payload: CardDescriptionPayload,
): Promise<CardDescriptionPersistResult> {
  const sanitizedDescription = sanitizeNullableUserText(payload.description);
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  const supabase = await createServerSupabaseClient();
  const { data: updatedCard, error } = await supabase
    .from("cards")
    .update({ description: sanitizedDescription })
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !updatedCard) {
    return {
      boardId: payload.boardId,
      error: error?.message ?? "Failed to update card description.",
      ok: false,
      workspaceSlug: payload.workspaceSlug,
    };
  }

  await logBoardActivity({
    action: "description.update",
    boardId: payload.boardId,
    entityId: payload.cardId,
    entityType: "card",
    metadata: {},
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

function parseUpdateCardCustomFieldsFormData(formData: FormData) {
  const statusField = formData.get("status");
  const priorityField = formData.get("priority");
  const effortField = formData.get("effort");

  return updateCardCustomFieldsSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    effort: typeof effortField === "string" ? effortField : undefined,
    priority: typeof priorityField === "string" ? priorityField : undefined,
    status: typeof statusField === "string" ? statusField : undefined,
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

function parseUpdateCardCompletionFormData(formData: FormData) {
  const isCompletedField = formData.get("isCompleted");

  return updateCardCompletionSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    isCompleted: typeof isCompletedField === "string" ? isCompletedField : undefined,
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

async function persistCardCustomFields(
  payload: CardCustomFieldsPayload,
): Promise<CardCustomFieldsPersistResult> {
  const parsedStatus = parseEnumValue(payload.status, CARD_STATUS_VALUES);
  if (parsedStatus.invalid) {
    return {
      boardId: payload.boardId,
      error: "Invalid card status value.",
      ok: false,
      workspaceSlug: payload.workspaceSlug,
    };
  }

  const parsedPriority = parseEnumValue(payload.priority, CARD_PRIORITY_VALUES);
  if (parsedPriority.invalid) {
    return {
      boardId: payload.boardId,
      error: "Invalid card priority value.",
      ok: false,
      workspaceSlug: payload.workspaceSlug,
    };
  }

  const effortValue = sanitizeNullableUserText(payload.effort);
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  const supabase = await createServerSupabaseClient();
  const { data: updatedCard, error } = await supabase
    .from("cards")
    .update({
      effort: effortValue,
      priority: parsedPriority.value,
      status: parsedStatus.value,
    })
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !updatedCard) {
    return {
      boardId: payload.boardId,
      error: error?.message ?? "Failed to update card custom fields.",
      ok: false,
      workspaceSlug: payload.workspaceSlug,
    };
  }

  await logBoardActivity({
    action: "custom_fields.update",
    boardId: payload.boardId,
    entityId: payload.cardId,
    entityType: "card",
    metadata: {
      effort: effortValue,
      priority: parsedPriority.value,
      status: parsedStatus.value,
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

export async function updateCardCustomFieldsInline(
  formData: FormData,
): Promise<{ error?: string; ok: boolean }> {
  const parsed = parseUpdateCardCustomFieldsFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid custom fields payload.", ok: false };
  }

  const persistResult = await persistCardCustomFields(parsed.data);
  if (!persistResult.ok) {
    return { error: persistResult.error, ok: false };
  }

  return { ok: true };
}

async function persistCardCompletion(
  payload: CardCompletionPayload,
): Promise<CardCompletionPersistResult> {
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  const isCompleted = payload.isCompleted === "true";
  const completedAt = isCompleted ? new Date().toISOString() : null;
  const supabase = await createServerSupabaseClient();
  const { data: updatedCard, error } = await supabase
    .from("cards")
    .update({
      completed_at: completedAt,
      is_completed: isCompleted,
    })
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !updatedCard) {
    return {
      boardId: payload.boardId,
      error: error?.message ?? "Failed to update card completion.",
      ok: false,
      workspaceSlug: payload.workspaceSlug,
    };
  }

  await logBoardActivity({
    action: "completion.toggle",
    boardId: payload.boardId,
    entityId: payload.cardId,
    entityType: "card",
    metadata: {
      completedAt,
      isCompleted,
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

export async function updateCardCompletionInline(
  formData: FormData,
): Promise<{ error?: string; ok: boolean }> {
  const parsed = parseUpdateCardCompletionFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid completion payload.", ok: false };
  }

  const persistResult = await persistCardCompletion(parsed.data);
  if (!persistResult.ok) {
    return { error: persistResult.error, ok: false };
  }

  return { ok: true };
}

type MoveCardPersistResult =
  | { ok: true; movedCard: { boardId: string; cardId: string; listId: string } }
  | { error: string; ok: false };
type UpsertPrivateInboxPersistResult =
  | { item: { cardId: string; position: number }; ok: true }
  | { error: string; ok: false };
type DeleteCardPersistResult =
  | { ok: true; deletedCardId: string }
  | { error: string; ok: false };

function parseMoveCardFormData(formData: FormData) {
  const nextParsed = moveCardWithDestinationSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    targetBoardId: formData.get("targetBoardId"),
    targetListId: formData.get("targetListId"),
    targetPositionIndex: formData.get("targetPositionIndex"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (nextParsed.success) {
    return { data: nextParsed.data as MoveCardPayload, success: true as const };
  }

  const legacyParsed = moveCardLegacySchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    listId: formData.get("listId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!legacyParsed.success) {
    return { success: false as const };
  }

  return {
    data: {
      boardId: legacyParsed.data.boardId,
      cardId: legacyParsed.data.cardId,
      targetBoardId: legacyParsed.data.boardId,
      targetListId: legacyParsed.data.listId,
      targetPositionIndex: 10000,
      workspaceSlug: legacyParsed.data.workspaceSlug,
    } satisfies MoveCardPayload,
    success: true as const,
  };
}

function parseMoveDestinationOptionsFormData(formData: FormData) {
  return moveDestinationOptionsSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

function parseUpsertPrivateInboxFormData(formData: FormData) {
  return upsertPrivateInboxItemSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    targetPositionIndex: formData.get("targetPositionIndex"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

function parseDeleteCardFormData(formData: FormData) {
  return deleteCardSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

type SupabaseQueryErrorLike = {
  code?: string;
  message: string;
};

function isMissingTableSchemaCacheError(
  error: SupabaseQueryErrorLike | null | undefined,
  tableName: string,
): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST205" || error.code === "42P01") {
    return true;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes(tableName.toLowerCase()) &&
    (normalizedMessage.includes("schema cache") || normalizedMessage.includes("could not find the table"))
  );
}

async function resolvePrivateInboxPositionCount(params: {
  boardId: string;
  cardId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
}): Promise<{ count: number; error?: string }> {
  const { data: privateInboxRowsData, error: privateInboxRowsError } = await params.supabase
    .from("board_private_inbox_items")
    .select("card_id")
    .eq("board_id", params.boardId)
    .eq("user_id", params.userId);
  if (privateInboxRowsError) {
    if (isMissingTableSchemaCacheError(privateInboxRowsError, "board_private_inbox_items")) {
      return { count: 1 };
    }

    return { count: 1, error: privateInboxRowsError.message };
  }

  const privateInboxRows = (privateInboxRowsData ?? []) as Array<{ card_id: string }>;
  const hasSourceCardInInbox = privateInboxRows.some((entry) => entry.card_id === params.cardId);
  return {
    count: Math.max(1, privateInboxRows.length + (hasSourceCardInInbox ? 0 : 1)),
  };
}

async function persistMoveDestinationOptions(
  payload: z.infer<typeof moveDestinationOptionsSchema>,
): Promise<{ error?: string; ok: boolean; options?: MoveDestinationOptions }> {
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId, {
    requiredPermission: "read",
  });

  const supabase = await createServerSupabaseClient();
  const { data: sourceCard, error: sourceCardError } = await supabase
    .from("cards")
    .select("id")
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .maybeSingle();
  if (!sourceCard || sourceCardError) {
    return { error: sourceCardError?.message ?? "Card not found.", ok: false };
  }

  const privateInboxPositionCountResult = await resolvePrivateInboxPositionCount({
    boardId: payload.boardId,
    cardId: payload.cardId,
    supabase,
    userId: access.userId,
  });
  if (privateInboxPositionCountResult.error) {
    return { error: privateInboxPositionCountResult.error, ok: false };
  }

  const { data: boardsData, error: boardsError } = await supabase
    .from("boards")
    .select("id, name, visibility, created_by, workspace_id")
    .eq("workspace_id", access.workspaceId)
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (boardsError) {
    return { error: boardsError.message, ok: false };
  }

  const writableBoards = ((boardsData ?? []) as Array<{
    created_by: string;
    id: string;
    name: string;
    visibility: BoardVisibility;
    workspace_id: string;
  }>).filter((entry) => canWriteBoardByRole({
    board: { created_by: entry.created_by, visibility: entry.visibility },
    role: access.role as WorkspaceRole,
    userId: access.userId,
  }));
  if (writableBoards.length < 1) {
    return { error: "No writable board found in current workspace.", ok: false };
  }

  const orderedBoards = writableBoards
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
    }))
    .sort((left, right) => {
      if (left.id === payload.boardId) {
        return -1;
      }
      if (right.id === payload.boardId) {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });
  const boardIds = orderedBoards.map((entry) => entry.id);

  const { data: listsData, error: listsError } = await supabase
    .from("lists")
    .select("id, title, board_id, position")
    .in("board_id", boardIds)
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (listsError) {
    return { error: listsError.message, ok: false };
  }

  const { data: cardsData, error: cardsError } = await supabase
    .from("cards")
    .select("id, list_id, board_id")
    .in("board_id", boardIds)
    .is("archived_at", null);
  if (cardsError) {
    return { error: cardsError.message, ok: false };
  }

  const cardCountByListId = new Map<string, number>();
  for (const cardRow of (cardsData ?? []) as Array<{ list_id: string | null }>) {
    if (!cardRow.list_id) {
      continue;
    }

    cardCountByListId.set(cardRow.list_id, (cardCountByListId.get(cardRow.list_id) ?? 0) + 1);
  }

  const listsByBoard = Object.fromEntries(
    boardIds.map((boardId) => [boardId, [] as MoveDestinationListOption[]]),
  ) as Record<string, MoveDestinationListOption[]>;
  for (const listRow of (listsData ?? []) as Array<{
    board_id: string;
    id: string;
    title: string;
  }>) {
    if (!listsByBoard[listRow.board_id]) {
      listsByBoard[listRow.board_id] = [];
    }
    listsByBoard[listRow.board_id].push({
      cardCount: cardCountByListId.get(listRow.id) ?? 0,
      id: listRow.id,
      title: listRow.title,
    });
  }

  return {
    ok: true,
    options: {
      boards: orderedBoards,
      currentBoardId: payload.boardId,
      listsByBoard,
      privateInboxPositionCount: privateInboxPositionCountResult.count,
    },
  };
}

async function persistMoveCard(payload: MoveCardPayload): Promise<MoveCardPersistResult> {
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  const supabase = await createServerSupabaseClient();
  const { data: sourceCard, error: sourceCardError } = await supabase
    .from("cards")
    .select("id, board_id, list_id")
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .maybeSingle();

  if (!sourceCard || sourceCardError) {
    return { error: sourceCardError?.message ?? "Card not found.", ok: false };
  }

  const { data: targetBoard, error: targetBoardError } = await supabase
    .from("boards")
    .select("id, workspace_id, visibility, created_by")
    .eq("id", payload.targetBoardId)
    .is("archived_at", null)
    .maybeSingle();
  if (!targetBoard || targetBoardError) {
    return { error: targetBoardError?.message ?? "Target board not found.", ok: false };
  }

  const typedTargetBoard = targetBoard as {
    created_by: string;
    id: string;
    visibility: BoardVisibility;
    workspace_id: string;
  };
  if (typedTargetBoard.workspace_id !== access.workspaceId) {
    return { error: "Target board must belong to current workspace.", ok: false };
  }
  if (!canWriteBoardByRole({
    board: { created_by: typedTargetBoard.created_by, visibility: typedTargetBoard.visibility },
    role: access.role as WorkspaceRole,
    userId: access.userId,
  })) {
    return { error: "You don't have permission to write to the target board.", ok: false };
  }

  const { data: targetList, error: targetListError } = await supabase
    .from("lists")
    .select("id")
    .eq("id", payload.targetListId)
    .eq("board_id", typedTargetBoard.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!targetList || targetListError) {
    return { error: targetListError?.message ?? "Target list not found.", ok: false };
  }

  const cards = await fetchCardsForBoard(typedTargetBoard.id);
  const cardsInTargetList = cards.filter(
    (entry) => entry.list_id === payload.targetListId && entry.id !== payload.cardId,
  );
  const nextPosition = resolveInsertPosition(cardsInTargetList, payload.targetPositionIndex);
  const { data: movedCard, error: moveError } = await supabase
    .from("cards")
    .update({
      board_id: typedTargetBoard.id,
      list_id: payload.targetListId,
      position: nextPosition,
    })
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (moveError || !movedCard) {
    return { error: moveError?.message ?? "Failed to move card.", ok: false };
  }

  await logBoardActivity({
    action: "move",
    boardId: typedTargetBoard.id,
    entityId: payload.cardId,
    entityType: "card",
    metadata: {
      crossBoard: payload.boardId !== typedTargetBoard.id,
      fromBoardId: payload.boardId,
      fromListId: sourceCard.list_id,
      targetPositionIndex: payload.targetPositionIndex,
      toBoardId: typedTargetBoard.id,
      toListId: payload.targetListId,
    },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(payload.workspaceSlug, payload.boardId));
  if (typedTargetBoard.id !== payload.boardId) {
    revalidatePath(boardRoute(payload.workspaceSlug, typedTargetBoard.id));
  }
  return { movedCard: { boardId: typedTargetBoard.id, cardId: payload.cardId, listId: payload.targetListId }, ok: true };
}

async function persistUpsertPrivateInboxItem(
  payload: UpsertPrivateInboxPayload,
): Promise<UpsertPrivateInboxPersistResult> {
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  const supabase = await createServerSupabaseClient();
  const { data: sourceCard, error: sourceCardError } = await supabase
    .from("cards")
    .select("id")
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .maybeSingle();
  if (!sourceCard || sourceCardError) {
    return { error: sourceCardError?.message ?? "Card not found.", ok: false };
  }

  const { data: existingRowsData, error: existingRowsError } = await supabase
    .from("board_private_inbox_items")
    .select("card_id, position")
    .eq("board_id", payload.boardId)
    .eq("user_id", access.userId)
    .neq("card_id", payload.cardId)
    .order("position", { ascending: true });
  if (existingRowsError) {
    if (isMissingTableSchemaCacheError(existingRowsError, "board_private_inbox_items")) {
      return { error: "Private inbox is not available yet. Please run the latest migration.", ok: false };
    }
    return { error: existingRowsError.message, ok: false };
  }

  const existingRows = (existingRowsData ?? []) as Array<{ card_id: string; position: number | string }>;
  const nextPosition = resolveInsertPosition(
    existingRows.map((entry) => ({ position: Number.parseFloat(String(entry.position)) || 0 })),
    payload.targetPositionIndex,
  );
  const { data: upsertedRow, error: upsertError } = await supabase
    .from("board_private_inbox_items")
    .upsert({
      board_id: payload.boardId,
      card_id: payload.cardId,
      position: nextPosition,
      updated_at: new Date().toISOString(),
      user_id: access.userId,
      workspace_id: access.workspaceId,
    }, { onConflict: "board_id,user_id,card_id" })
    .select("card_id, position")
    .maybeSingle();
  if (!upsertedRow || upsertError) {
    return { error: upsertError?.message ?? "Failed to add card to private inbox.", ok: false };
  }

  await logBoardActivity({
    action: "inbox.private.upsert",
    boardId: payload.boardId,
    entityId: payload.cardId,
    entityType: "card",
    metadata: {
      position: nextPosition,
      targetPositionIndex: payload.targetPositionIndex,
      userId: access.userId,
    },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(payload.workspaceSlug, payload.boardId));
  return { item: { cardId: payload.cardId, position: nextPosition }, ok: true };
}

async function persistDeleteCard(payload: z.infer<typeof deleteCardSchema>): Promise<DeleteCardPersistResult> {
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  const supabase = await createServerSupabaseClient();
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id")
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .maybeSingle();

  if (!card || cardError) {
    return { error: cardError?.message ?? "Card not found.", ok: false };
  }

  const { data: attachments, error: attachmentsError } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("card_id", payload.cardId);

  if (attachmentsError) {
    return { error: attachmentsError.message, ok: false };
  }

  const storagePaths = ((attachments ?? []) as { storage_path: string | null }[])
    .map((entry) => entry.storage_path)
    .filter((path): path is string => Boolean(path && path.length > 0));

  const uniqueStoragePaths = Array.from(new Set(storagePaths));

  if (uniqueStoragePaths.length > 0) {
    const { data: sharedPathRows, error: sharedPathError } = await supabase
      .from("attachments")
      .select("storage_path")
      .in("storage_path", uniqueStoragePaths)
      .neq("card_id", payload.cardId);
    if (sharedPathError) {
      return { error: sharedPathError.message, ok: false };
    }

    const sharedPaths = new Set(
      ((sharedPathRows ?? []) as { storage_path: string | null }[])
        .map((entry) => entry.storage_path)
        .filter((path): path is string => Boolean(path && path.length > 0)),
    );
    const removableStoragePaths = uniqueStoragePaths.filter((path) => !sharedPaths.has(path));

    if (removableStoragePaths.length > 0) {
      const { error: removeFilesError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove(removableStoragePaths);
      if (removeFilesError) {
        return { error: removeFilesError.message, ok: false };
      }
    }
  }

  const { data: deletedCard, error: deleteError } = await supabase
    .from("cards")
    .delete()
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deletedCard) {
    return { error: deleteError?.message ?? "Failed to delete card.", ok: false };
  }

  await logBoardActivity({
    action: "delete",
    boardId: payload.boardId,
    entityId: payload.cardId,
    entityType: "card",
    metadata: {},
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(payload.workspaceSlug, payload.boardId));
  return { deletedCardId: payload.cardId, ok: true };
}

export async function moveCard(formData: FormData) {
  const parsed = parseMoveCardFormData(formData);
  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const persistResult = await persistMoveCard(parsed.data);
  if (!persistResult.ok) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, persistResult.error));
  }

  redirect(boardRoute(parsed.data.workspaceSlug, persistResult.movedCard.boardId));
}

export async function getMoveDestinationOptionsInline(
  formData: FormData,
): Promise<{ error?: string; ok: boolean; options?: MoveDestinationOptions }> {
  const parsed = parseMoveDestinationOptionsFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid move destination payload.", ok: false };
  }

  try {
    return persistMoveDestinationOptions(parsed.data);
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to load move destinations."), ok: false };
  }
}

export async function moveCardInline(
  formData: FormData,
): Promise<{ error?: string; movedCard?: { boardId: string; cardId: string; listId: string }; ok: boolean }> {
  const parsed = parseMoveCardFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid move payload.", ok: false };
  }

  try {
    const persistResult = await persistMoveCard(parsed.data);
    if (!persistResult.ok) {
      return { error: persistResult.error, ok: false };
    }

    return { movedCard: persistResult.movedCard, ok: true };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to move card."), ok: false };
  }
}

export async function upsertPrivateInboxItemInline(
  formData: FormData,
): Promise<{ error?: string; item?: { cardId: string; position: number }; ok: boolean }> {
  const parsed = parseUpsertPrivateInboxFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid private inbox payload.", ok: false };
  }

  try {
    const persistResult = await persistUpsertPrivateInboxItem(parsed.data);
    if (!persistResult.ok) {
      return { error: persistResult.error, ok: false };
    }

    return { item: persistResult.item, ok: true };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to update private inbox."), ok: false };
  }
}

export async function deleteCard(formData: FormData) {
  const parsed = parseDeleteCardFormData(formData);
  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const persistResult = await persistDeleteCard(parsed.data);
  if (!persistResult.ok) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, persistResult.error));
  }

  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function deleteCardInline(
  formData: FormData,
): Promise<{ deletedCardId?: string; error?: string; ok: boolean }> {
  const parsed = parseDeleteCardFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid delete payload.", ok: false };
  }

  try {
    const persistResult = await persistDeleteCard(parsed.data);
    if (!persistResult.ok) {
      return { error: persistResult.error, ok: false };
    }

    return { deletedCardId: persistResult.deletedCardId, ok: true };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to delete card."), ok: false };
  }
}
