"use client";

import { useCallback, useRef, useState } from "react";

import type { DragData } from "./board-dnd-helpers";

export function useBoardCanvasState({
  cleanupMutationIds,
  initialBoardVersion,
}: {
  cleanupMutationIds: (store: Map<string, number>, nowMs: number) => void;
  initialBoardVersion: number;
}) {
  const localMutationIdsRef = useRef<Map<string, number>>(new Map());
  const boardVersionRef = useRef(initialBoardVersion);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const setBoardVersionSafe = useCallback((nextBoardVersion?: number) => {
    if (
      typeof nextBoardVersion !== "number" ||
      !Number.isFinite(nextBoardVersion) ||
      nextBoardVersion <= boardVersionRef.current
    ) {
      return;
    }

    boardVersionRef.current = nextBoardVersion;
  }, []);

  const getExpectedBoardVersion = useCallback(() => boardVersionRef.current, []);

  const rememberMutationId = useCallback((mutationId: string) => {
    const nowMs = Date.now();
    cleanupMutationIds(localMutationIdsRef.current, nowMs);
    localMutationIdsRef.current.set(mutationId, nowMs);
  }, [cleanupMutationIds]);

  const shouldIgnoreMutationId = useCallback((mutationId?: string) => {
    if (!mutationId) {
      return false;
    }

    const nowMs = Date.now();
    cleanupMutationIds(localMutationIdsRef.current, nowMs);
    return typeof localMutationIdsRef.current.get(mutationId) === "number";
  }, [cleanupMutationIds]);

  return {
    activeCardId,
    activeDragData,
    getExpectedBoardVersion,
    notice,
    rememberMutationId,
    setActiveCardId,
    setActiveDragData,
    setBoardVersionSafe,
    setNotice,
    shouldIgnoreMutationId,
  };
}

export function resolveActiveCardId(
  currentValue: string | null,
  cardId: string,
  isOpen: boolean,
): string | null {
  if (isOpen) {
    return cardId;
  }

  return currentValue === cardId ? null : currentValue;
}
