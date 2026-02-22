"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ListWithCards } from "../types";

import {
  buildCardIntentFlushBatch,
  createMutationId,
  dequeuePendingMutation,
  enqueueCardConflictRetry,
  enqueuePendingMutation,
  executePendingMutationRequest,
  hasPendingMutations,
  normalizeMutationFailure,
  type PendingMutationInput,
  type PendingMutationPayload,
  type PersistenceResult,
  toMutationError,
} from "./board-dnd-persistence-helpers";
import {
  getDropTarget,
  moveCardLocally,
  reorderListsLocally,
  type DragData,
} from "./board-dnd-helpers";

export type { PersistenceResult } from "./board-dnd-persistence-helpers";

type MutationDependencies = {
  boardId: string;
  rememberMutationId: (mutationId: string) => void;
  reportError: (result: PersistenceResult, fallbackMessage: string) => void;
  setBoardVersion: (version?: number) => void;
  setLists: (lists: ListWithCards[]) => void;
  setNotice: (message: string | null) => void;
  workspaceSlug: string;
};

export type DropHandlerContext = MutationDependencies & {
  getExpectedBoardVersion: () => number;
  lists: ListWithCards[];
};

function useFlushPendingMutation(params: {
  boardId: string;
  confirmedListsRef: React.MutableRefObject<ListWithCards[]>;
  getExpectedBoardVersion: () => number;
  inFlightRef: React.MutableRefObject<boolean>;
  inFlightPayloadRef: React.MutableRefObject<PendingMutationPayload | null>;
  latestSeqRef: React.MutableRefObject<number>;
  listsRef: React.MutableRefObject<ListWithCards[]>;
  pendingMutationsRef: React.MutableRefObject<PendingMutationPayload[]>;
  rememberMutationId: (mutationId: string) => void;
  reportError: (result: PersistenceResult, fallbackMessage: string) => void;
  setBoardVersion: (version?: number) => void;
  setLists: (lists: ListWithCards[]) => void;
  setNotice: (message: string | null) => void;
  workspaceSlug: string;
}) {
  return useCallback(async function flushPendingMutation() {
    if (params.inFlightRef.current) {
      return;
    }

    const payload = dequeuePendingMutation(params.pendingMutationsRef);
    if (!payload) {
      return;
    }

    params.inFlightRef.current = true;
    params.inFlightPayloadRef.current = payload;
    params.setNotice(null);
    params.rememberMutationId(payload.mutationId);

    try {
      const result = await executePendingMutationRequest({
        boardId: params.boardId,
        expectedBoardVersion: params.getExpectedBoardVersion(),
        payload,
        workspaceSlug: params.workspaceSlug,
      });

      if (!result.ok) {
        throw toMutationError(result, payload.fallbackMessage);
      }

      params.setBoardVersion(result.boardVersion);
      params.confirmedListsRef.current = payload.nextLists;
    } catch (error) {
      const failedResult = normalizeMutationFailure(error, payload.fallbackMessage);
      const isStaleResult = payload.seq < params.latestSeqRef.current;
      if (isStaleResult) {
        if (failedResult.code === "CONFLICT") {
          params.setBoardVersion(failedResult.latestBoardVersion);
        }
        return;
      }

      if (failedResult.code === "CONFLICT") {
        params.setBoardVersion(failedResult.latestBoardVersion);
        const queuedRetry = enqueueCardConflictRetry({
          latestSeqRef: params.latestSeqRef,
          payload,
          pendingMutationsRef: params.pendingMutationsRef,
        });
        if (!queuedRetry) {
          params.confirmedListsRef.current = params.listsRef.current;
        }
        return;
      }

      params.setLists(params.confirmedListsRef.current);
      params.listsRef.current = params.confirmedListsRef.current;
      params.reportError(failedResult, payload.fallbackMessage);
    } finally {
      params.inFlightRef.current = false;
      params.inFlightPayloadRef.current = null;
      if (hasPendingMutations(params.pendingMutationsRef)) {
        void flushPendingMutation();
      }
    }
  }, [params]);
}

function useDebouncedDndPersistence({
  boardId,
  getExpectedBoardVersion,
  lists,
  rememberMutationId,
  reportError,
  setBoardVersion,
  setLists,
  setNotice,
  workspaceSlug,
}: DropHandlerContext) {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const inFlightPayloadRef = useRef<PendingMutationPayload | null>(null);
  const latestSeqRef = useRef(0);
  const pendingMutationsRef = useRef<PendingMutationPayload[]>([]);
  const confirmedListsRef = useRef(lists);
  const listsRef = useRef(lists);

  useEffect(() => {
    listsRef.current = lists;
    if (!inFlightRef.current && pendingMutationsRef.current.length < 1) {
      confirmedListsRef.current = lists;
    }
  }, [lists]);

  const clearDebounceTimer = useCallback(() => {
    if (!debounceTimerRef.current) {
      return;
    }

    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = null;
  }, []);

  const flushPendingMutation = useFlushPendingMutation({
    boardId,
    confirmedListsRef,
    getExpectedBoardVersion,
    inFlightRef,
    inFlightPayloadRef,
    latestSeqRef,
    listsRef,
    pendingMutationsRef,
    rememberMutationId,
    reportError,
    setBoardVersion,
    setLists,
    setNotice,
    workspaceSlug,
  });

  const scheduleMutation = useCallback((payload: PendingMutationInput) => {
    enqueuePendingMutation({
      clearDebounceTimer,
      debounceTimerRef,
      flushPendingMutation,
      inFlightRef,
      latestSeqRef,
      payload,
      pendingMutationsRef,
    });
  }, [clearDebounceTimer, flushPendingMutation]);

  const flushCardIntentsOnUnload = useCallback(() => {
    const pendingCardIntents = buildCardIntentFlushBatch({
      inFlightPayload: inFlightPayloadRef.current,
      pendingMutations: pendingMutationsRef.current,
    });
    if (pendingCardIntents.length < 1) {
      return;
    }

    const payload = JSON.stringify({
      boardId,
      expectedBoardVersion: getExpectedBoardVersion(),
      mutations: pendingCardIntents,
      workspaceSlug,
    });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/board/dnd/flush-intent", blob)) {
        return;
      }
    }

    void fetch("/api/board/dnd/flush-intent", {
      body: payload,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      method: "POST",
    });
  }, [boardId, getExpectedBoardVersion, workspaceSlug]);

  useEffect(() => {
    return () => {
      clearDebounceTimer();
    };
  }, [clearDebounceTimer]);

  useEffect(() => {
    const handlePageExit = () => {
      flushCardIntentsOnUnload();
    };

    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    return () => {
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
    };
  }, [flushCardIntentsOnUnload]);

  return {
    listsRef,
    scheduleMutation,
    setListsOptimistic: (nextLists: ListWithCards[]) => {
      listsRef.current = nextLists;
      setLists(nextLists);
      setNotice(null);
    },
  };
}

function findCardAnchorId(targetList: ListWithCards, cardId: string): string | null | undefined {
  const movedCardIndex = targetList.cards.findIndex((card) => card.id === cardId);
  if (movedCardIndex < 0) {
    return undefined;
  }

  return targetList.cards[movedCardIndex + 1]?.id ?? null;
}

export function useBoardDropHandlers({
  boardId,
  getExpectedBoardVersion,
  lists,
  rememberMutationId,
  reportError,
  setBoardVersion,
  setLists,
  setNotice,
  workspaceSlug,
}: DropHandlerContext) {
  const { listsRef, scheduleMutation, setListsOptimistic } = useDebouncedDndPersistence({
    boardId,
    getExpectedBoardVersion,
    lists,
    rememberMutationId,
    reportError,
    setBoardVersion,
    setLists,
    setNotice,
    workspaceSlug,
  });

  const handleListDrop = useCallback((activeData: DragData, overData: DragData | null) => {
    if (overData?.type !== "list") {
      return;
    }

    const currentLists = listsRef.current;
    const nextLists = reorderListsLocally(currentLists, activeData.listId, overData.listId);
    if (nextLists === currentLists) {
      return;
    }

    setListsOptimistic(nextLists);
    scheduleMutation({
      fallbackMessage: "Failed to reorder lists. Local order was reverted.",
      mutationId: createMutationId(),
      nextLists,
      orderedListIds: nextLists.map((list) => list.id),
      type: "list",
    });
  }, [listsRef, scheduleMutation, setListsOptimistic]);

  const handleCardDrop = useCallback((activeData: DragData, overData: DragData | null) => {
    if (activeData.type !== "card") {
      return;
    }

    const dropTarget = getDropTarget(overData);
    if (!dropTarget) {
      return;
    }

    const currentLists = listsRef.current;
    const nextLists = moveCardLocally(
      currentLists,
      activeData.cardId,
      activeData.listId,
      dropTarget.listId,
      dropTarget.cardId,
    );

    if (nextLists === currentLists) {
      return;
    }

    const targetList = nextLists.find((list) => list.id === dropTarget.listId);
    if (!targetList) {
      return;
    }

    const beforeCardId = findCardAnchorId(targetList, activeData.cardId);
    if (beforeCardId === undefined) {
      return;
    }
    setListsOptimistic(nextLists);
    scheduleMutation({
      beforeCardId,
      cardId: activeData.cardId,
      fallbackMessage: "Failed to move card. Local move was reverted.",
      mutationId: createMutationId(),
      nextLists,
      toListId: dropTarget.listId,
      type: "card",
    });
  }, [listsRef, scheduleMutation, setListsOptimistic]);

  return {
    handleCardDrop,
    handleListDrop,
  };
}
