"use client";

import { useQuery } from "@tanstack/react-query";

import type { ListWithCards } from "../types";

export const BOARD_SNAPSHOT_QUERY_KEY = "board-snapshot";

export type BoardSnapshotQueryData = {
  boardVersion: number;
  fetchedAt: string;
  lists: ListWithCards[];
};

export function buildBoardSnapshotQueryKey(params: {
  boardId: string;
  workspaceSlug: string;
}) {
  return [BOARD_SNAPSHOT_QUERY_KEY, params.workspaceSlug, params.boardId] as const;
}

type BoardSnapshotApiResponse = {
  boardVersion: number;
  fetchedAt: string;
  lists: ListWithCards[];
};

function isBoardSnapshotApiResponse(payload: unknown): payload is BoardSnapshotApiResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as {
    boardVersion?: unknown;
    fetchedAt?: unknown;
    lists?: unknown;
  };
  return (
    typeof candidate.boardVersion === "number" &&
    typeof candidate.fetchedAt === "string" &&
    Array.isArray(candidate.lists)
  );
}

async function queryBoardSnapshot(params: {
  boardId: string;
  workspaceSlug: string;
}): Promise<BoardSnapshotQueryData> {
  const query = new URLSearchParams({
    workspaceSlug: params.workspaceSlug,
  });
  const response = await fetch(
    `/api/board/${encodeURIComponent(params.boardId)}/snapshot?${query.toString()}`,
    {
      cache: "no-store",
      credentials: "include",
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load board snapshot.");
  }

  const payload = (await response.json()) as unknown;
  if (!isBoardSnapshotApiResponse(payload)) {
    throw new Error("Invalid board snapshot payload.");
  }

  return {
    boardVersion: payload.boardVersion,
    fetchedAt: payload.fetchedAt,
    lists: payload.lists,
  };
}

export function useBoardSnapshotQuery(params: {
  boardId: string;
  initialData: BoardSnapshotQueryData;
  workspaceSlug: string;
}) {
  return useQuery({
    initialData: params.initialData,
    queryFn: async () =>
      queryBoardSnapshot({
        boardId: params.boardId,
        workspaceSlug: params.workspaceSlug,
      }),
    queryKey: buildBoardSnapshotQueryKey({
      boardId: params.boardId,
      workspaceSlug: params.workspaceSlug,
    }),
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
}
