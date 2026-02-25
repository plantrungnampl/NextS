import { NextResponse } from "next/server";
import { z } from "zod";

import { getOptionalAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";

type DndResultCode = "CONFLICT" | "FORBIDDEN" | "INVALID" | "NOT_FOUND" | "INTERNAL" | "RATE_LIMITED";

type MoveCardIntentResult = {
  boardVersion?: number;
  code?: DndResultCode;
  latestBoardVersion?: number;
  message?: string;
  ok: boolean;
};

type RpcResult = {
  boardVersion?: number | string;
  code?: DndResultCode;
  latestBoardVersion?: number | string;
  message?: string;
  ok?: boolean;
};

const flushMutationSchema = z.object({
  beforeCardId: z.string().uuid().nullable(),
  cardId: z.string().uuid(),
  mutationId: z.string().uuid(),
  toListId: z.string().uuid(),
});

const flushSchema = z.object({
  boardId: z.string().uuid(),
  expectedBoardVersion: z.coerce.number().int().min(1),
  mutations: z.array(flushMutationSchema).min(1).max(64),
  workspaceSlug: z.string().trim().min(1).max(64),
});

function parsePositiveInt(value: number | string | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

function toActionResult(payload: RpcResult): MoveCardIntentResult {
  if (payload.ok) {
    return {
      boardVersion: parsePositiveInt(payload.boardVersion, 0) || undefined,
      ok: true,
    };
  }

  return {
    code: payload.code ?? "INTERNAL",
    latestBoardVersion: parsePositiveInt(payload.latestBoardVersion, 0) || undefined,
    message: payload.message ?? "Mutation failed.",
    ok: false,
  };
}

async function runMoveCardIntentRpc(params: {
  beforeCardId: string | null;
  boardId: string;
  cardId: string;
  expectedBoardVersion: number;
  mutationId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  toListId: string;
}): Promise<MoveCardIntentResult> {
  const { data, error } = await params.supabase.rpc("move_card_with_intent_version", {
    before_card_id: params.beforeCardId,
    expected_board_version: params.expectedBoardVersion,
    mutation_id: params.mutationId,
    target_board_id: params.boardId,
    target_card_id: params.cardId,
    to_list_id: params.toListId,
  });

  if (error) {
    return {
      code: "INTERNAL",
      message: error.message,
      ok: false,
    };
  }

  return toActionResult((data ?? {}) as RpcResult);
}

async function runIntentWithRetries(params: {
  boardId: string;
  expectedBoardVersion: number;
  mutation: z.infer<typeof flushMutationSchema>;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}): Promise<{ boardVersion: number; result: MoveCardIntentResult }> {
  let expectedBoardVersion = params.expectedBoardVersion;

  const primary = await runMoveCardIntentRpc({
    beforeCardId: params.mutation.beforeCardId,
    boardId: params.boardId,
    cardId: params.mutation.cardId,
    expectedBoardVersion,
    mutationId: params.mutation.mutationId,
    supabase: params.supabase,
    toListId: params.mutation.toListId,
  });
  if (primary.ok) {
    return {
      boardVersion: parsePositiveInt(primary.boardVersion, expectedBoardVersion),
      result: primary,
    };
  }

  expectedBoardVersion = parsePositiveInt(primary.latestBoardVersion, expectedBoardVersion);
  if (primary.code !== "CONFLICT") {
    return { boardVersion: expectedBoardVersion, result: primary };
  }

  const sameAnchorRetry = await runMoveCardIntentRpc({
    beforeCardId: params.mutation.beforeCardId,
    boardId: params.boardId,
    cardId: params.mutation.cardId,
    expectedBoardVersion,
    mutationId: params.mutation.mutationId,
    supabase: params.supabase,
    toListId: params.mutation.toListId,
  });
  if (sameAnchorRetry.ok) {
    return {
      boardVersion: parsePositiveInt(sameAnchorRetry.boardVersion, expectedBoardVersion),
      result: sameAnchorRetry,
    };
  }

  expectedBoardVersion = parsePositiveInt(sameAnchorRetry.latestBoardVersion, expectedBoardVersion);
  if (sameAnchorRetry.code !== "CONFLICT" || params.mutation.beforeCardId === null) {
    return { boardVersion: expectedBoardVersion, result: sameAnchorRetry };
  }

  const fallbackAnchorRetry = await runMoveCardIntentRpc({
    beforeCardId: null,
    boardId: params.boardId,
    cardId: params.mutation.cardId,
    expectedBoardVersion,
    mutationId: params.mutation.mutationId,
    supabase: params.supabase,
    toListId: params.mutation.toListId,
  });

  return {
    boardVersion: parsePositiveInt(fallbackAnchorRetry.latestBoardVersion, expectedBoardVersion),
    result: fallbackAnchorRetry,
  };
}

export async function POST(request: Request) {
  const parsedBody = flushSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ message: "Invalid flush payload.", ok: false }, { status: 400 });
  }

  const authContext = await getOptionalAuthContext();
  if (!authContext) {
    return NextResponse.json({ message: "Unauthorized.", ok: false }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: canWriteBoard, error: accessError } = await supabase.rpc("can_write_board", {
    target_board_id: parsedBody.data.boardId,
  });

  if (accessError || !canWriteBoard) {
    return NextResponse.json({ message: "Forbidden.", ok: false }, { status: 403 });
  }

  let expectedBoardVersion = parsedBody.data.expectedBoardVersion;
  const results: Array<{ cardId: string; code?: string; ok: boolean }> = [];

  for (const mutation of parsedBody.data.mutations) {
    const outcome = await runIntentWithRetries({
      boardId: parsedBody.data.boardId,
      expectedBoardVersion,
      mutation,
      supabase,
    });
    expectedBoardVersion = outcome.boardVersion;

    results.push({
      cardId: mutation.cardId,
      code: outcome.result.code,
      ok: outcome.result.ok,
    });
  }

  return NextResponse.json({
    boardVersion: expectedBoardVersion,
    ok: results.every((entry) => entry.ok),
    results,
  });
}
