"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { sanitizeNullableUserText, sanitizeUserText } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { boardRoute, fetchCardsForBoard, fetchOrderedLists, logBoardActivity, resolveBoardAccess } from "./actions.shared";
import { nextPositionFromTail } from "./utils";

const createListInlineSchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  workspaceSlug: z.string().trim().min(3).max(64),
});

const renameListInlineSchema = z.object({
  boardId: z.string().uuid(),
  listId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  workspaceSlug: z.string().trim().min(3).max(64),
});

const createCardInlineSchema = z.object({
  boardId: z.string().uuid(),
  description: z.string().trim().max(5000).optional(),
  listId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  workspaceSlug: z.string().trim().min(3).max(64),
});

const renameCardInlineSchema = z.object({
  boardId: z.string().uuid(),
  cardId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  workspaceSlug: z.string().trim().min(3).max(64),
});

const archiveListInlineSchema = z.object({
  boardId: z.string().uuid(),
  listId: z.string().uuid(),
  workspaceSlug: z.string().trim().min(3).max(64),
});

export type CreateListInlineResult = {
  error?: string;
  list?: {
    id: string;
    position: number;
    title: string;
  };
  ok: boolean;
};

export type RenameListInlineResult = {
  error?: string;
  list?: {
    id: string;
    title: string;
  };
  ok: boolean;
};

export type CreateCardInlineResult = {
  card?: {
    description: string | null;
    id: string;
    listId: string;
    position: number;
    title: string;
  };
  error?: string;
  ok: boolean;
};

export type RenameCardInlineResult = {
  card?: {
    id: string;
    title: string;
  };
  error?: string;
  ok: boolean;
};

export type ArchiveListInlineResult = {
  archivedListId?: string;
  error?: string;
  ok: boolean;
};

export async function createListInline(input: {
  boardId: string;
  title: string;
  workspaceSlug: string;
}): Promise<CreateListInlineResult> {
  const parsed = createListInlineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid list payload.",
      ok: false,
    };
  }

  const sanitizedTitle = sanitizeUserText(parsed.data.title);
  if (sanitizedTitle.length < 1) {
    return {
      error: "List title is required.",
      ok: false,
    };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const lists = await fetchOrderedLists(parsed.data.boardId);
    const nextPosition = nextPositionFromTail(lists);

    const supabase = await createServerSupabaseClient();
    const { data: createdList, error } = await supabase
      .from("lists")
      .insert({
        board_id: parsed.data.boardId,
        position: nextPosition,
        title: sanitizedTitle,
      })
      .select("id")
      .single();

    if (error || !createdList) {
      return {
        error: error?.message ?? "Failed to create list.",
        ok: false,
      };
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

    return {
      list: {
        id: createdList.id,
        position: nextPosition,
        title: sanitizedTitle,
      },
      ok: true,
    };
  } catch (error) {
    const message = resolveInlineActionErrorMessage(error, "Failed to create list.");
    return {
      error: message,
      ok: false,
    };
  }
}

export async function renameListInline(input: {
  boardId: string;
  listId: string;
  title: string;
  workspaceSlug: string;
}): Promise<RenameListInlineResult> {
  const parsed = renameListInlineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid list payload.",
      ok: false,
    };
  }

  const sanitizedTitle = sanitizeUserText(parsed.data.title);
  if (sanitizedTitle.length < 1) {
    return {
      error: "List title is required.",
      ok: false,
    };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("lists")
      .update({ title: sanitizedTitle })
      .eq("id", parsed.data.listId)
      .eq("board_id", parsed.data.boardId);

    if (error) {
      return {
        error: error.message,
        ok: false,
      };
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

    return {
      list: {
        id: parsed.data.listId,
        title: sanitizedTitle,
      },
      ok: true,
    };
  } catch (error) {
    const message = resolveInlineActionErrorMessage(error, "Failed to rename list.");
    return {
      error: message,
      ok: false,
    };
  }
}

export async function createCardInline(input: {
  boardId: string;
  description?: string;
  listId: string;
  title: string;
  workspaceSlug: string;
}): Promise<CreateCardInlineResult> {
  const parsed = createCardInlineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid card payload.",
      ok: false,
    };
  }

  const sanitizedTitle = sanitizeUserText(parsed.data.title);
  if (sanitizedTitle.length < 1) {
    return {
      error: "Card title is required.",
      ok: false,
    };
  }
  const sanitizedDescription = sanitizeNullableUserText(parsed.data.description);

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const cards = await fetchCardsForBoard(parsed.data.boardId);
    const cardsInList = cards.filter((entry) => entry.list_id === parsed.data.listId);
    const nextPosition = nextPositionFromTail(cardsInList);
    const supabase = await createServerSupabaseClient();
    const { data: createdCard, error } = await supabase
      .from("cards")
      .insert({
        board_id: parsed.data.boardId,
        created_by: access.userId,
        description: sanitizedDescription,
        list_id: parsed.data.listId,
        position: nextPosition,
        title: sanitizedTitle,
      })
      .select("id")
      .single();

    if (error || !createdCard) {
      return {
        error: error?.message ?? "Failed to create card.",
        ok: false,
      };
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

    return {
      card: {
        description: sanitizedDescription,
        id: createdCard.id,
        listId: parsed.data.listId,
        position: nextPosition,
        title: sanitizedTitle,
      },
      ok: true,
    };
  } catch (error) {
    const message = resolveInlineActionErrorMessage(error, "Failed to create card.");
    return {
      error: message,
      ok: false,
    };
  }
}

export async function renameCardInline(input: {
  boardId: string;
  cardId: string;
  title: string;
  workspaceSlug: string;
}): Promise<RenameCardInlineResult> {
  const parsed = renameCardInlineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid card payload.",
      ok: false,
    };
  }

  const sanitizedTitle = sanitizeUserText(parsed.data.title);
  if (sanitizedTitle.length < 1) {
    return {
      error: "Card title is required.",
      ok: false,
    };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("cards")
      .update({ title: sanitizedTitle })
      .eq("id", parsed.data.cardId)
      .eq("board_id", parsed.data.boardId);

    if (error) {
      return {
        error: error.message,
        ok: false,
      };
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

    return {
      card: {
        id: parsed.data.cardId,
        title: sanitizedTitle,
      },
      ok: true,
    };
  } catch (error) {
    const message = resolveInlineActionErrorMessage(error, "Failed to rename card.");
    return {
      error: message,
      ok: false,
    };
  }
}

export async function archiveListInline(input: {
  boardId: string;
  listId: string;
  workspaceSlug: string;
}): Promise<ArchiveListInlineResult> {
  const parsed = archiveListInlineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid list payload.",
      ok: false,
    };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    const archivedAt = new Date().toISOString();

    const { data: archivedList, error: listError } = await supabase
      .from("lists")
      .update({ archived_at: archivedAt })
      .eq("id", parsed.data.listId)
      .eq("board_id", parsed.data.boardId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (listError || !archivedList) {
      return {
        error: listError?.message ?? "List archive failed. It may already be archived.",
        ok: false,
      };
    }

    const { error: cardArchiveError } = await supabase
      .from("cards")
      .update({ archived_at: archivedAt })
      .eq("board_id", parsed.data.boardId)
      .eq("list_id", parsed.data.listId)
      .is("archived_at", null);

    if (cardArchiveError) {
      return {
        error: cardArchiveError.message,
        ok: false,
      };
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

    return {
      archivedListId: parsed.data.listId,
      ok: true,
    };
  } catch (error) {
    const message = resolveInlineActionErrorMessage(error, "Failed to archive list.");
    return {
      error: message,
      ok: false,
    };
  }
}
