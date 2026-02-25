"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { APP_ROUTES, sanitizeNullableUserText, sanitizeUserText } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import {
  boardRoute,
  fetchCardsForBoard,
  fetchOrderedLists,
  logBoardActivity,
  resolveBoardAccess,
  withBoardError,
  withWorkspaceMessage,
} from "./actions.shared";
import { nextPositionFromTail } from "./utils";

const boardPathSchema = z.object({
  boardId: z.uuid(),
  workspaceSlug: z.string().trim().min(3).max(64),
});

const renameBoardSchema = boardPathSchema.extend({
  name: z.string().trim().min(1).max(160),
});

const createListSchema = boardPathSchema.extend({
  title: z.string().trim().min(1).max(200),
});

const renameListSchema = boardPathSchema.extend({
  listId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
});

const createCardSchema = boardPathSchema.extend({
  description: z.string().trim().max(5000).optional(),
  listId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
});

const renameCardSchema = boardPathSchema.extend({
  cardId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
});

const archiveBoardSchema = boardPathSchema;

const archiveListSchema = boardPathSchema.extend({
  listId: z.string().uuid(),
});

const archiveCardSchema = boardPathSchema.extend({
  cardId: z.string().uuid(),
});

function nowIsoString(): string {
  return new Date().toISOString();
}

export async function renameBoard(formData: FormData) {
  const parsed = renameBoardSchema.safeParse({
    boardId: formData.get("boardId"),
    name: formData.get("name"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }
  const sanitizedName = sanitizeUserText(parsed.data.name);
  if (sanitizedName.length < 1) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, "Board name is required."));
  }

  const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("boards")
    .update({ name: sanitizedName })
    .eq("id", parsed.data.boardId)
    .eq("workspace_id", access.workspaceId);

  if (error) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, error.message));
  }

  await logBoardActivity({
    action: "rename",
    boardId: parsed.data.boardId,
    entityId: parsed.data.boardId,
    entityType: "board",
    metadata: { name: sanitizedName },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function createList(formData: FormData) {
  const parsed = createListSchema.safeParse({
    boardId: formData.get("boardId"),
    title: formData.get("title"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }
  const sanitizedTitle = sanitizeUserText(parsed.data.title);
  if (sanitizedTitle.length < 1) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, "List title is required."));
  }

  const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
  const lists = await fetchOrderedLists(parsed.data.boardId);
  const supabase = await createServerSupabaseClient();
  const { data: createdList, error } = await supabase
    .from("lists")
    .insert({
      board_id: parsed.data.boardId,
      position: nextPositionFromTail(lists),
      title: sanitizedTitle,
    })
    .select("id")
    .single();

  if (error || !createdList) {
    redirect(
      withBoardError(
        parsed.data.workspaceSlug,
        parsed.data.boardId,
        error?.message ?? "Failed to create list.",
      ),
    );
  }

  await logBoardActivity({
    action: "create",
    boardId: parsed.data.boardId,
    entityId: createdList.id,
    entityType: "list",
    metadata: { title: sanitizedTitle },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function renameList(formData: FormData) {
  const parsed = renameListSchema.safeParse({
    boardId: formData.get("boardId"),
    listId: formData.get("listId"),
    title: formData.get("title"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }
  const sanitizedTitle = sanitizeUserText(parsed.data.title);
  if (sanitizedTitle.length < 1) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, "List title is required."));
  }

  const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("lists")
    .update({ title: sanitizedTitle })
    .eq("id", parsed.data.listId)
    .eq("board_id", parsed.data.boardId);

  if (error) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, error.message));
  }

  await logBoardActivity({
    action: "rename",
    boardId: parsed.data.boardId,
    entityId: parsed.data.listId,
    entityType: "list",
    metadata: { title: sanitizedTitle },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function createCard(formData: FormData) {
  const parsed = createCardSchema.safeParse({
    boardId: formData.get("boardId"),
    description: formData.get("description"),
    listId: formData.get("listId"),
    title: formData.get("title"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }
  const sanitizedTitle = sanitizeUserText(parsed.data.title);
  if (sanitizedTitle.length < 1) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, "Card title is required."));
  }
  const sanitizedDescription = sanitizeNullableUserText(parsed.data.description);

  const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
  const cards = await fetchCardsForBoard(parsed.data.boardId);
  const cardsInList = cards.filter((entry) => entry.list_id === parsed.data.listId);
  const supabase = await createServerSupabaseClient();
  const { data: createdCard, error } = await supabase
    .from("cards")
    .insert({
      board_id: parsed.data.boardId,
      created_by: access.userId,
      description: sanitizedDescription,
      list_id: parsed.data.listId,
      position: nextPositionFromTail(cardsInList),
      title: sanitizedTitle,
    })
    .select("id")
    .single();

  if (error || !createdCard) {
    redirect(
      withBoardError(
        parsed.data.workspaceSlug,
        parsed.data.boardId,
        error?.message ?? "Failed to create card.",
      ),
    );
  }

  await logBoardActivity({
    action: "create",
    boardId: parsed.data.boardId,
    entityId: createdCard.id,
    entityType: "card",
    metadata: { listId: parsed.data.listId, title: sanitizedTitle },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function renameCard(formData: FormData) {
  const parsed = renameCardSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    title: formData.get("title"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }
  const sanitizedTitle = sanitizeUserText(parsed.data.title);
  if (sanitizedTitle.length < 1) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, "Card title is required."));
  }

  const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("cards")
    .update({ title: sanitizedTitle })
    .eq("id", parsed.data.cardId)
    .eq("board_id", parsed.data.boardId);

  if (error) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, error.message));
  }

  await logBoardActivity({
    action: "rename",
    boardId: parsed.data.boardId,
    entityId: parsed.data.cardId,
    entityType: "card",
    metadata: { title: sanitizedTitle },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function archiveBoard(formData: FormData) {
  const parsed = archiveBoardSchema.safeParse({
    boardId: formData.get("boardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
  const supabase = await createServerSupabaseClient();
  const { data: archivedBoard, error } = await supabase
    .from("boards")
    .update({ archived_at: nowIsoString() })
    .eq("id", parsed.data.boardId)
    .eq("workspace_id", access.workspaceId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !archivedBoard) {
    redirect(
      withBoardError(
        parsed.data.workspaceSlug,
        parsed.data.boardId,
        error?.message ?? "Board archive failed. It may already be archived.",
      ),
    );
  }

  await logBoardActivity({
    action: "archive",
    boardId: parsed.data.boardId,
    entityId: parsed.data.boardId,
    entityType: "board",
    metadata: {},
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(APP_ROUTES.workspace.index);
  redirect(withWorkspaceMessage(parsed.data.workspaceSlug, "Board archived.", "success"));
}

export async function archiveList(formData: FormData) {
  const parsed = archiveListSchema.safeParse({
    boardId: formData.get("boardId"),
    listId: formData.get("listId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
  const supabase = await createServerSupabaseClient();
  const archivedAt = nowIsoString();

  const { data: archivedList, error: listError } = await supabase
    .from("lists")
    .update({ archived_at: archivedAt })
    .eq("id", parsed.data.listId)
    .eq("board_id", parsed.data.boardId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (listError || !archivedList) {
    redirect(
      withBoardError(
        parsed.data.workspaceSlug,
        parsed.data.boardId,
        listError?.message ?? "List archive failed. It may already be archived.",
      ),
    );
  }

  const { error: cardArchiveError } = await supabase
    .from("cards")
    .update({ archived_at: archivedAt })
    .eq("board_id", parsed.data.boardId)
    .eq("list_id", parsed.data.listId)
    .is("archived_at", null);

  if (cardArchiveError) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, cardArchiveError.message));
  }

  await logBoardActivity({
    action: "archive",
    boardId: parsed.data.boardId,
    entityId: parsed.data.listId,
    entityType: "list",
    metadata: {},
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

type ArchiveCardInlineResult =
  | { ok: true; archivedCardId: string }
  | { error: string; ok: false };

function parseArchiveCardFormData(formData: FormData) {
  return archiveCardSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

async function persistArchiveCard(
  payload: z.infer<typeof archiveCardSchema>,
): Promise<ArchiveCardInlineResult> {
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  const supabase = await createServerSupabaseClient();
  const { data: archivedCard, error } = await supabase
    .from("cards")
    .update({ archived_at: nowIsoString() })
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !archivedCard) {
    return {
      error: error?.message ?? "Card archive failed. It may already be archived.",
      ok: false,
    };
  }

  await logBoardActivity({
    action: "archive",
    boardId: payload.boardId,
    entityId: payload.cardId,
    entityType: "card",
    metadata: {},
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(payload.workspaceSlug, payload.boardId));
  return { archivedCardId: payload.cardId, ok: true };
}

export async function archiveCard(formData: FormData) {
  const parsed = parseArchiveCardFormData(formData);
  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const persistResult = await persistArchiveCard(parsed.data);
  if (!persistResult.ok) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, persistResult.error));
  }

  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function archiveCardInline(
  formData: FormData,
): Promise<{ archivedCardId?: string; error?: string; ok: boolean }> {
  const parsed = parseArchiveCardFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid archive payload.", ok: false };
  }

  try {
    const persistResult = await persistArchiveCard(parsed.data);
    if (!persistResult.ok) {
      return { error: persistResult.error, ok: false };
    }

    return { archivedCardId: persistResult.archivedCardId, ok: true };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to archive card."), ok: false };
  }
}
