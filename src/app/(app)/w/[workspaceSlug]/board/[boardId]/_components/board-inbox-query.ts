"use client";

import { useQuery } from "@tanstack/react-query";

import type { CardRecord } from "../types";

export const BOARD_PRIVATE_INBOX_QUERY_KEY = "board-private-inbox";

function buildBoardPrivateInboxQueryKey(params: {
  boardId: string;
  workspaceSlug: string;
}) {
  return [BOARD_PRIVATE_INBOX_QUERY_KEY, params.workspaceSlug, params.boardId] as const;
}

function isCardRecordArray(payload: unknown): payload is CardRecord[] {
  return Array.isArray(payload) && payload.every((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const candidate = entry as {
      id?: unknown;
      list_id?: unknown;
      title?: unknown;
    };

    return (
      typeof candidate.id === "string" &&
      typeof candidate.list_id === "string" &&
      typeof candidate.title === "string"
    );
  });
}

async function queryBoardPrivateInbox(params: {
  boardId: string;
  workspaceSlug: string;
}): Promise<CardRecord[]> {
  const query = new URLSearchParams({
    workspaceSlug: params.workspaceSlug,
  });

  const response = await fetch(
    `/api/board/${encodeURIComponent(params.boardId)}/private-inbox?${query.toString()}`,
    {
      cache: "no-store",
      credentials: "include",
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load private inbox cards.");
  }

  const payload = (await response.json()) as unknown;
  if (!isCardRecordArray(payload)) {
    throw new Error("Invalid private inbox payload.");
  }

  return payload;
}

export function useBoardInboxQuery(params: {
  boardId: string;
  enabled: boolean;
  initialData: CardRecord[];
  workspaceSlug: string;
}) {
  return useQuery({
    enabled: params.enabled,
    initialData: params.initialData,
    queryFn: async () =>
      queryBoardPrivateInbox({
        boardId: params.boardId,
        workspaceSlug: params.workspaceSlug,
      }),
    queryKey: buildBoardPrivateInboxQueryKey({
      boardId: params.boardId,
      workspaceSlug: params.workspaceSlug,
    }),
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
}
