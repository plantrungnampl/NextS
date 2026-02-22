"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { toggleCardWatchInline } from "../actions.card-advanced";
import type { CardRecord } from "../types";
import { cancelCardRichnessQuery, invalidateCardRichnessQuery } from "./board-mutations/invalidation";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";

type WatchOptimisticPatch = {
  watchCount?: number;
  watchedByViewer?: boolean;
};

type UseCardWatchOptimisticToggleParams = {
  boardId: string;
  canWrite: boolean;
  card: Pick<CardRecord, "id" | "watchCount" | "watchedByViewer">;
  mutationKeySuffix?: string;
  onOptimisticCardPatch?: (patch: WatchOptimisticPatch) => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
};

type WatchMutationVariables = {
  sequence: number;
};

function buildFormData(entries: Array<[string, string]>): FormData {
  const formData = new FormData();
  for (const [key, value] of entries) {
    formData.set(key, value);
  }

  return formData;
}

export function useCardWatchOptimisticToggle(params: UseCardWatchOptimisticToggleParams) {
  const queryClient = useQueryClient();
  const [inflightCount, setInflightCount] = useState(0);
  const inflightCountRef = useRef(0);
  const mutationSequenceRef = useRef(0);
  const optimisticWatchStateRef = useRef<{
    watchCount: number;
    watchedByViewer: boolean;
  }>({
    watchCount: params.card.watchCount ?? 0,
    watchedByViewer: params.card.watchedByViewer === true,
  });
  const needsResyncRef = useRef(false);

  useEffect(() => {
    if (inflightCountRef.current > 0) {
      return;
    }

    optimisticWatchStateRef.current = {
      watchCount: params.card.watchCount ?? 0,
      watchedByViewer: params.card.watchedByViewer === true,
    };
  }, [params.card.watchCount, params.card.watchedByViewer]);

  const modalMutationKey = buildCardModalMutationKey({
    boardId: params.boardId,
    cardId: params.card.id,
    workspaceSlug: params.workspaceSlug,
  });
  const watchMutation = useMutation({
    mutationKey: [...modalMutationKey, params.mutationKeySuffix ?? "watch"],
    mutationFn: async (_variables: WatchMutationVariables) => {
      return toggleCardWatchInline(
        buildFormData([
          ["boardId", params.boardId],
          ["cardId", params.card.id],
          ["workspaceSlug", params.workspaceSlug],
        ]),
      );
    },
    onError: () => {
      needsResyncRef.current = true;
    },
    onMutate: () => {
      inflightCountRef.current += 1;
      setInflightCount(inflightCountRef.current);
      cancelCardRichnessQuery({
        boardId: params.boardId,
        cardId: params.card.id,
        queryClient,
        richnessQueryKey: params.richnessQueryKey,
        workspaceSlug: params.workspaceSlug,
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        needsResyncRef.current = true;
        return;
      }
    },
    onSettled: () => {
      inflightCountRef.current = Math.max(0, inflightCountRef.current - 1);
      setInflightCount(inflightCountRef.current);
      if (inflightCountRef.current > 0) {
        return;
      }

      invalidateCardRichnessQuery({
        boardId: params.boardId,
        cardId: params.card.id,
        queryClient,
        richnessQueryKey: params.richnessQueryKey,
        workspaceSlug: params.workspaceSlug,
      });
      needsResyncRef.current = false;
    },
  });

  return {
    toggleWatch: () => {
      if (!params.canWrite) {
        return;
      }

      const previousState = optimisticWatchStateRef.current;
      const nextWatchedByViewer = !previousState.watchedByViewer;
      const nextWatchCount = Math.max(
        0,
        previousState.watchCount + (nextWatchedByViewer ? 1 : -1),
      );
      optimisticWatchStateRef.current = {
        watchCount: nextWatchCount,
        watchedByViewer: nextWatchedByViewer,
      };
      params.onOptimisticCardPatch?.({
        watchCount: nextWatchCount,
        watchedByViewer: nextWatchedByViewer,
      });

      mutationSequenceRef.current += 1;
      watchMutation.mutate({ sequence: mutationSequenceRef.current });
    },
    watchPending: inflightCount > 0,
  };
}
