"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { LoadingCardModalSkeleton } from "@/components/ui";

import { queryCardRichnessSnapshot } from "../actions.card-richness";
import type {
  CardRecord,
  CardRichnessSnapshot,
  ChecklistRecord,
  CommentRecord,
  LabelRecord,
  WorkspaceMemberRecord,
} from "../types";

type CardRichnessLoadState = "error" | "idle" | "loading" | "ready";

export const EMPTY_CARD_RICHNESS: CardRichnessSnapshot = {
  assignees: [],
  attachments: [],
  checklists: [],
  comments: [],
  labels: [],
};
export const CARD_CHECKLIST_QUERY_KEY = "card-richness-checklists";
export const CARD_RICHNESS_QUERY_KEY = "card-richness";
export const CARD_MODAL_SNAPSHOT_STALE_TIME_MS = 60_000;

export type CardChecklistQueryData = {
  checklists: ChecklistRecord[];
};

function normalizeSnapshot(payload: unknown): CardRichnessSnapshot {
  if (!payload || typeof payload !== "object") {
    return EMPTY_CARD_RICHNESS;
  }

  const candidate = payload as {
    assignees?: unknown;
    attachments?: unknown;
    checklists?: unknown;
    comments?: unknown;
    labels?: unknown;
  };

  return {
    assignees: Array.isArray(candidate.assignees)
      ? (candidate.assignees as WorkspaceMemberRecord[])
      : [],
    attachments: Array.isArray(candidate.attachments)
      ? (candidate.attachments as CardRichnessSnapshot["attachments"])
      : [],
    checklists: Array.isArray(candidate.checklists)
      ? (candidate.checklists as CardRichnessSnapshot["checklists"])
      : [],
    comments: Array.isArray(candidate.comments)
      ? (candidate.comments as CommentRecord[])
      : [],
    labels: Array.isArray(candidate.labels) ? (candidate.labels as LabelRecord[]) : [],
  };
}

export function buildChecklistDataFromRichnessSnapshot(snapshot: CardRichnessSnapshot): CardChecklistQueryData {
  return { checklists: snapshot.checklists };
}

export function buildRichnessSnapshotFromCard(
  card: Pick<CardRecord, "assignees" | "attachments" | "comments" | "labels"> & {
    checklists?: ChecklistRecord[];
  },
): CardRichnessSnapshot {
  return {
    assignees: card.assignees,
    attachments: card.attachments,
    checklists: card.checklists ?? [],
    comments: card.comments,
    labels: card.labels,
  };
}

export async function fetchCardRichnessSnapshotQueryData(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}) {
  const payload = await queryCardRichnessSnapshot({
    boardId: params.boardId,
    cardId: params.cardId,
    workspaceSlug: params.workspaceSlug,
  });
  return normalizeSnapshot(payload);
}

export function buildCardChecklistQueryKey(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}) {
  return [CARD_CHECKLIST_QUERY_KEY, params.workspaceSlug, params.boardId, params.cardId] as const;
}

export function useCardChecklistQuery(params: {
  boardId: string;
  cardId: string;
  enabled?: boolean;
  initialData?: CardChecklistQueryData;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const checklistQueryKey = buildCardChecklistQueryKey({
    boardId: params.boardId,
    cardId: params.cardId,
    workspaceSlug: params.workspaceSlug,
  });
  const richnessQueryKey = buildCardRichnessQueryKey({
    boardId: params.boardId,
    cardId: params.cardId,
    workspaceSlug: params.workspaceSlug,
  });
  const cachedChecklistData = queryClient.getQueryData<CardChecklistQueryData>(checklistQueryKey);
  const cachedRichnessData = queryClient.getQueryData<CardRichnessSnapshot>(richnessQueryKey);

  return useQuery({
    enabled: params.enabled ?? true,
    queryFn: async () => {
      const richnessSnapshot = await queryClient.ensureQueryData({
        queryFn: async () => fetchCardRichnessSnapshotQueryData({
          boardId: params.boardId,
          cardId: params.cardId,
          workspaceSlug: params.workspaceSlug,
        }),
        queryKey: richnessQueryKey,
        staleTime: CARD_MODAL_SNAPSHOT_STALE_TIME_MS,
      });
      const checklistData = buildChecklistDataFromRichnessSnapshot(richnessSnapshot);
      queryClient.setQueryData(checklistQueryKey, checklistData);
      return checklistData;
    },
    placeholderData:
      cachedChecklistData ??
      (cachedRichnessData
        ? buildChecklistDataFromRichnessSnapshot(cachedRichnessData)
        : params.initialData),
    queryKey: checklistQueryKey,
    refetchOnWindowFocus: false,
    staleTime: CARD_MODAL_SNAPSHOT_STALE_TIME_MS,
  });
}

export function buildCardRichnessQueryKey(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}) {
  return [CARD_RICHNESS_QUERY_KEY, params.workspaceSlug, params.boardId, params.cardId] as const;
}

export function useCardRichnessQuery(params: {
  boardId: string;
  cardId: string;
  enabled?: boolean;
  initialData?: CardRichnessSnapshot;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const richnessQueryKey = buildCardRichnessQueryKey({
    boardId: params.boardId,
    cardId: params.cardId,
    workspaceSlug: params.workspaceSlug,
  });
  const cachedRichnessData = queryClient.getQueryData<CardRichnessSnapshot>(richnessQueryKey);

  return useQuery({
    enabled: params.enabled ?? true,
    queryFn: async () => {
      const snapshot = await fetchCardRichnessSnapshotQueryData({
        boardId: params.boardId,
        cardId: params.cardId,
        workspaceSlug: params.workspaceSlug,
      });
      queryClient.setQueryData(
        buildCardChecklistQueryKey({
          boardId: params.boardId,
          cardId: params.cardId,
          workspaceSlug: params.workspaceSlug,
        }),
        buildChecklistDataFromRichnessSnapshot(snapshot),
      );
      return snapshot;
    },
    placeholderData: cachedRichnessData ?? params.initialData,
    queryKey: richnessQueryKey,
    refetchOnWindowFocus: false,
    staleTime: CARD_MODAL_SNAPSHOT_STALE_TIME_MS,
  });
}

export function useCardRichnessSnapshot(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}) {
  const [status, setStatus] = useState<CardRichnessLoadState>("idle");
  const [snapshot, setSnapshot] = useState<CardRichnessSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const loadSnapshot = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setStatus("loading");
    setErrorMessage(null);

    try {
      const payload = await queryCardRichnessSnapshot({
        boardId: params.boardId,
        cardId: params.cardId,
        workspaceSlug: params.workspaceSlug,
      });

      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      setSnapshot(normalizeSnapshot(payload));
      setStatus("ready");
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      setStatus("error");
      setErrorMessage(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Failed to load card details.",
      );
    }
  }, [params.boardId, params.cardId, params.workspaceSlug]);

  return {
    errorMessage,
    loadSnapshot,
    snapshot,
    status,
  };
}

export function CardRichnessLoading() {
  return <LoadingCardModalSkeleton />;
}

export function CardRichnessError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-md border border-rose-700/60 bg-rose-950/30 px-3 py-2">
      <p className="text-xs text-rose-200">{message}</p>
      <button
        className="mt-2 inline-flex min-h-8 items-center rounded border border-rose-700 bg-rose-900/30 px-2 text-[11px] font-semibold text-rose-100 hover:bg-rose-900/50"
        onClick={onRetry}
        type="button"
      >
        Retry loading details
      </button>
    </div>
  );
}
