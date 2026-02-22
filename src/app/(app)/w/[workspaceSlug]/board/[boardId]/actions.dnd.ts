"use server";

import { z } from "zod";

import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
  RateLimitExceededError,
} from "@/core/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveBoardAccess } from "./actions.shared";
import { parseNumeric } from "./utils";

type DndErrorCode = "CONFLICT" | "FORBIDDEN" | "INVALID" | "NOT_FOUND" | "INTERNAL" | "RATE_LIMITED";

type DndActionResult = {
  boardVersion?: number;
  code?: DndErrorCode;
  latestBoardVersion?: number;
  message?: string;
  ok: boolean;
};

type RpcResult = {
  boardVersion?: number;
  code?: DndErrorCode;
  latestBoardVersion?: number;
  message?: string;
  ok?: boolean;
};

type DndListOrderSnapshot = {
  listId: string;
  orderedCardIds: string[];
};

type DndListOrdersResult = {
  boardVersion?: number;
  code?: DndErrorCode;
  listOrders?: DndListOrderSnapshot[];
  message?: string;
  ok: boolean;
};

const boardPathSchema = z.object({
  boardId: z.string().uuid(),
  expectedBoardVersion: z.coerce.number().int().min(1),
  mutationId: z.string().uuid(),
  workspaceSlug: z.string().trim().min(3).max(64),
});

const reorderListsSchema = boardPathSchema.extend({
  orderedListIds: z.array(z.string().uuid()).min(1).max(120),
});

const reorderCardsSchema = boardPathSchema.extend({
  cardId: z.string().uuid(),
  fromListId: z.string().uuid(),
  orderedCardIds: z.array(z.string().uuid()).min(1).max(2000),
  toListId: z.string().uuid(),
});

const moveCardIntentSchema = boardPathSchema.extend({
  beforeCardId: z.string().uuid().nullable().optional(),
  cardId: z.string().uuid(),
  toListId: z.string().uuid(),
});

const listOrdersSchema = z.object({
  boardId: z.string().uuid(),
  listIds: z.array(z.string().uuid()).min(1).max(32),
  workspaceSlug: z.string().trim().min(3).max(64),
});

function toDndResult(payload: RpcResult): DndActionResult {
  if (payload.ok) {
    return {
      boardVersion:
        typeof payload.boardVersion === "number" && payload.boardVersion > 0
          ? payload.boardVersion
          : undefined,
      ok: true,
    };
  }

  return {
    code: payload.code ?? "INTERNAL",
    latestBoardVersion:
      typeof payload.latestBoardVersion === "number" && payload.latestBoardVersion > 0
        ? payload.latestBoardVersion
        : undefined,
    message: payload.message ?? "Mutation failed.",
    ok: false,
  };
}

function mapRpcError(error: { code?: string; message: string }): DndActionResult {
  if (error.code === "42883") {
    return {
      code: "INTERNAL",
      message: "Server migration is missing. Apply latest database migrations.",
      ok: false,
    };
  }

  return {
    code: "INTERNAL",
    message: error.message,
    ok: false,
  };
}

function mapListOrdersError(error: unknown): DndListOrdersResult {
  if (error instanceof Error) {
    return { code: "INTERNAL", message: error.message, ok: false };
  }

  return { code: "INTERNAL", message: "Failed to fetch list order snapshot.", ok: false };
}

export async function reorderListsDnd(payload: unknown): Promise<DndActionResult> {
  const supabase = await createServerSupabaseClient();
  const parsed = reorderListsSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      code: "INVALID",
      message: "Invalid list reorder request.",
      ok: false,
    };
  }

  const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.boardDnd,
      subjectParts: [`board:${parsed.data.boardId}`, `user:${access.userId}`, "action:reorder-lists"],
      supabase,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        code: "RATE_LIMITED",
        message: `Too many drag actions. Try again in ${error.retryAfterSeconds}s.`,
        ok: false,
      };
    }

    throw error;
  }

  const { data, error } = await supabase.rpc("reorder_lists_with_version", {
    expected_board_version: parsed.data.expectedBoardVersion,
    mutation_id: parsed.data.mutationId,
    ordered_list_ids: parsed.data.orderedListIds,
    target_board_id: parsed.data.boardId,
  });

  if (error) {
    return mapRpcError(error);
  }

  return toDndResult((data ?? {}) as RpcResult);
}

export async function reorderCardsDnd(payload: unknown): Promise<DndActionResult> {
  const supabase = await createServerSupabaseClient();
  const parsed = reorderCardsSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      code: "INVALID",
      message: "Invalid card move request.",
      ok: false,
    };
  }

  const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.boardDnd,
      subjectParts: [`board:${parsed.data.boardId}`, `user:${access.userId}`, "action:reorder-cards"],
      supabase,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        code: "RATE_LIMITED",
        message: `Too many drag actions. Try again in ${error.retryAfterSeconds}s.`,
        ok: false,
      };
    }

    throw error;
  }

  const { data, error } = await supabase.rpc("reorder_cards_with_version", {
    expected_board_version: parsed.data.expectedBoardVersion,
    from_list_id: parsed.data.fromListId,
    mutation_id: parsed.data.mutationId,
    ordered_card_ids: parsed.data.orderedCardIds,
    target_board_id: parsed.data.boardId,
    target_card_id: parsed.data.cardId,
    to_list_id: parsed.data.toListId,
  });

  if (error) {
    return mapRpcError(error);
  }

  return toDndResult((data ?? {}) as RpcResult);
}

export async function moveCardIntentDnd(payload: unknown): Promise<DndActionResult> {
  const supabase = await createServerSupabaseClient();
  const parsed = moveCardIntentSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      code: "INVALID",
      message: "Invalid card move intent request.",
      ok: false,
    };
  }

  const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.boardDnd,
      subjectParts: [`board:${parsed.data.boardId}`, `user:${access.userId}`, "action:move-card-intent"],
      supabase,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        code: "RATE_LIMITED",
        message: `Too many drag actions. Try again in ${error.retryAfterSeconds}s.`,
        ok: false,
      };
    }

    throw error;
  }

  const { data, error } = await supabase.rpc("move_card_with_intent_version", {
    before_card_id: parsed.data.beforeCardId ?? null,
    expected_board_version: parsed.data.expectedBoardVersion,
    mutation_id: parsed.data.mutationId,
    target_board_id: parsed.data.boardId,
    target_card_id: parsed.data.cardId,
    to_list_id: parsed.data.toListId,
  });

  if (error) {
    return mapRpcError(error);
  }

  return toDndResult((data ?? {}) as RpcResult);
}

export async function getListCardOrdersDnd(payload: unknown): Promise<DndListOrdersResult> {
  const parsed = listOrdersSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      code: "INVALID",
      message: "Invalid list snapshot request.",
      ok: false,
    };
  }

  try {
    await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId, { requiredPermission: "read" });
    const supabase = await createServerSupabaseClient();
    const uniqueListIds = Array.from(new Set(parsed.data.listIds));
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("sync_version")
      .eq("id", parsed.data.boardId)
      .maybeSingle();

    if (boardError) {
      return {
        code: "INTERNAL",
        message: boardError.message,
        ok: false,
      };
    }

    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select("id, list_id, position")
      .eq("board_id", parsed.data.boardId)
      .in("list_id", uniqueListIds)
      .is("archived_at", null)
      .order("position", { ascending: true });

    if (cardsError) {
      return {
        code: "INTERNAL",
        message: cardsError.message,
        ok: false,
      };
    }

    const orderedIdsByListId = new Map<string, string[]>(
      uniqueListIds.map((listId) => [listId, []]),
    );
    for (const entry of (cards ?? []) as Array<{ id: string; list_id: string; position: number | string }>) {
      const current = orderedIdsByListId.get(entry.list_id) ?? [];
      current.push(entry.id);
      orderedIdsByListId.set(entry.list_id, current);
    }

    return {
      boardVersion: parseNumeric((board?.sync_version ?? 0) as number | string),
      listOrders: uniqueListIds.map((listId) => ({
        listId,
        orderedCardIds: orderedIdsByListId.get(listId) ?? [],
      })),
      ok: true,
    };
  } catch (error) {
    return mapListOrdersError(error);
  }
}
