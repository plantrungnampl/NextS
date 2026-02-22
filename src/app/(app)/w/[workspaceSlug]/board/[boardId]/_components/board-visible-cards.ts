"use client";

import { useCallback, useMemo, useState } from "react";

import type { ListWithCards } from "../types";

const DEFAULT_VISIBLE_CARDS_PER_LIST = 50;
const LOAD_MORE_CARDS_STEP = 50;

function buildVisibleCardCountByList(
  lists: ListWithCards[],
  expandedCounts: Record<string, number>,
): Record<string, number> {
  const nextCounts: Record<string, number> = {};

  for (const list of lists) {
    const expandedCount = expandedCounts[list.id];
    const normalizedExpandedCount =
      typeof expandedCount === "number" && Number.isFinite(expandedCount)
        ? Math.max(expandedCount, DEFAULT_VISIBLE_CARDS_PER_LIST)
        : DEFAULT_VISIBLE_CARDS_PER_LIST;

    nextCounts[list.id] = Math.min(list.cards.length, normalizedExpandedCount);
  }

  return nextCounts;
}

export function useVisibleCardCountByList(lists: ListWithCards[]) {
  const [expandedCardCountByList, setExpandedCardCountByList] = useState<Record<string, number>>(
    {},
  );
  const visibleCardCountByList = useMemo(
    () => buildVisibleCardCountByList(lists, expandedCardCountByList),
    [expandedCardCountByList, lists],
  );

  const onLoadMoreCards = useCallback(
    (listId: string) => {
      setExpandedCardCountByList((previousCounts) => {
        const targetList = lists.find((list) => list.id === listId);
        if (!targetList) {
          return previousCounts;
        }

        const currentVisibleCount =
          previousCounts[listId] ?? Math.min(targetList.cards.length, DEFAULT_VISIBLE_CARDS_PER_LIST);
        const nextVisibleCount = Math.min(
          targetList.cards.length,
          currentVisibleCount + LOAD_MORE_CARDS_STEP,
        );

        if (nextVisibleCount === currentVisibleCount) {
          return previousCounts;
        }

        return {
          ...previousCounts,
          [listId]: nextVisibleCount,
        };
      });
    },
    [lists],
  );

  return {
    loadMoreStep: LOAD_MORE_CARDS_STEP,
    onLoadMoreCards,
    visibleCardCountByList,
  };
}
