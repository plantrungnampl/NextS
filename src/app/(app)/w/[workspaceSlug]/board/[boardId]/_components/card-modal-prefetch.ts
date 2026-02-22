"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import {
  buildCardChecklistQueryKey,
  buildCardRichnessQueryKey,
  buildChecklistDataFromRichnessSnapshot,
  CARD_MODAL_SNAPSHOT_STALE_TIME_MS,
  fetchCardRichnessSnapshotQueryData,
} from "./card-richness-loader";

const CARD_MODAL_PREFETCH_DELAY_MS = 180;

export function useCardModalPrefetch(params: {
  boardId: string;
  cardId: string;
  isModalOpen: boolean;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchCardModalData = () => {
    if (params.isModalOpen) {
      return;
    }

    const richnessQueryKey = buildCardRichnessQueryKey({
      boardId: params.boardId,
      cardId: params.cardId,
      workspaceSlug: params.workspaceSlug,
    });
    const checklistQueryKey = buildCardChecklistQueryKey({
      boardId: params.boardId,
      cardId: params.cardId,
      workspaceSlug: params.workspaceSlug,
    });
    void queryClient.prefetchQuery({
      queryFn: async () => {
        const snapshot = await fetchCardRichnessSnapshotQueryData({
          boardId: params.boardId,
          cardId: params.cardId,
          workspaceSlug: params.workspaceSlug,
        });
        queryClient.setQueryData(
          checklistQueryKey,
          buildChecklistDataFromRichnessSnapshot(snapshot),
        );
        return snapshot;
      },
      queryKey: richnessQueryKey,
      staleTime: CARD_MODAL_SNAPSHOT_STALE_TIME_MS,
    });
  };
  const schedulePrefetch = () => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }
    prefetchTimerRef.current = setTimeout(() => {
      prefetchTimerRef.current = null;
      prefetchCardModalData();
    }, CARD_MODAL_PREFETCH_DELAY_MS);
  };
  const cancelPrefetch = () => {
    if (!prefetchTimerRef.current) {
      return;
    }
    clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (!prefetchTimerRef.current) {
        return;
      }
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    };
  }, []);

  return {
    cancelPrefetch,
    schedulePrefetch,
  };
}
