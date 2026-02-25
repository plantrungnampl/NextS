"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { CardRecord } from "../../types";
import type { BoardSnapshotQueryData } from "../board-snapshot-query";

export type BoardSnapshotMutationContext = {
  previousSnapshot?: BoardSnapshotQueryData;
};

function withFreshSnapshotTimestamp(snapshot: BoardSnapshotQueryData): BoardSnapshotQueryData {
  return {
    ...snapshot,
    fetchedAt: new Date().toISOString(),
  };
}

export function safeBoardSnapshotPatch(
  queryClient: QueryClient,
  queryKey: QueryKey,
  patcher: (snapshot: BoardSnapshotQueryData) => BoardSnapshotQueryData,
) {
  queryClient.setQueryData<BoardSnapshotQueryData>(queryKey, (currentSnapshot) => {
    if (!currentSnapshot) {
      return currentSnapshot;
    }

    return withFreshSnapshotTimestamp(patcher(currentSnapshot));
  });
}

export function updateListTitleInSnapshot(params: {
  listId: string;
  snapshot: BoardSnapshotQueryData;
  title: string;
}): BoardSnapshotQueryData {
  return {
    ...params.snapshot,
    lists: params.snapshot.lists.map((list) => (
      list.id === params.listId ? { ...list, title: params.title } : list
    )),
  };
}

export function updateCardTitleInSnapshot(params: {
  cardId: string;
  snapshot: BoardSnapshotQueryData;
  title: string;
}): BoardSnapshotQueryData {
  return {
    ...params.snapshot,
    lists: params.snapshot.lists.map((list) => ({
      ...list,
      cards: list.cards.map((card) => (
        card.id === params.cardId ? { ...card, title: params.title } : card
      )),
    })),
  };
}

export function updateCardDescriptionInSnapshot(params: {
  cardId: string;
  description: string | null;
  snapshot: BoardSnapshotQueryData;
}): BoardSnapshotQueryData {
  return {
    ...params.snapshot,
    lists: params.snapshot.lists.map((list) => ({
      ...list,
      cards: list.cards.map((card) => (
        card.id === params.cardId ? { ...card, description: params.description } : card
      )),
    })),
  };
}

export function adjustCardAttachmentCountInSnapshot(params: {
  cardId: string;
  delta: number;
  snapshot: BoardSnapshotQueryData;
}): BoardSnapshotQueryData {
  if (!Number.isFinite(params.delta) || params.delta === 0) {
    return params.snapshot;
  }

  let changed = false;
  const nextLists = params.snapshot.lists.map((list) => {
    let listChanged = false;
    const nextCards = list.cards.map((card) => {
      if (card.id !== params.cardId) {
        return card;
      }

      const currentAttachmentCount = card.attachmentCount ?? card.attachments.length;
      const nextAttachmentCount = Math.max(0, currentAttachmentCount + params.delta);
      if (nextAttachmentCount === currentAttachmentCount) {
        return card;
      }

      changed = true;
      listChanged = true;
      return {
        ...card,
        attachmentCount: nextAttachmentCount,
      };
    });

    if (!listChanged) {
      return list;
    }

    return {
      ...list,
      cards: nextCards,
    };
  });

  if (!changed) {
    return params.snapshot;
  }

  return {
    ...params.snapshot,
    lists: nextLists,
  };
}

export function removeListFromSnapshot(params: {
  listId: string;
  snapshot: BoardSnapshotQueryData;
}): BoardSnapshotQueryData {
  return {
    ...params.snapshot,
    lists: params.snapshot.lists.filter((list) => list.id !== params.listId),
  };
}

function buildInlineCreatedCard(params: {
  description: string | null;
  id: string;
  listId: string;
  position: number;
  title: string;
}): CardRecord {
  return {
    assignees: [],
    attachmentCount: 0,
    attachments: [],
    checklistCompletedCount: 0,
    checklistTotalCount: 0,
    commentCount: 0,
    comments: [],
    completed_at: null,
    coverColor: null,
    coverColorblindFriendly: false,
    coverAttachmentId: null,
    coverMode: "none",
    coverSize: "full",
    description: params.description,
    due_at: null,
    effort: null,
    has_due_time: false,
    has_start_time: false,
    id: params.id,
    is_completed: false,
    is_template: false,
    labels: [],
    list_id: params.listId,
    position: params.position,
    priority: null,
    recurrence_anchor_at: null,
    recurrence_rrule: null,
    recurrence_tz: null,
    reminder_offset_minutes: null,
    start_at: null,
    status: null,
    title: params.title,
    updated_at: new Date().toISOString(),
    watchCount: 0,
    watchedByViewer: false,
  };
}

export function insertCardInListSnapshot(params: {
  card: {
    description: string | null;
    id: string;
    listId: string;
    position: number;
    title: string;
  };
  snapshot: BoardSnapshotQueryData;
}): BoardSnapshotQueryData {
  return {
    ...params.snapshot,
    lists: params.snapshot.lists.map((list) => {
      if (list.id !== params.card.listId) {
        return list;
      }

      if (list.cards.some((card) => card.id === params.card.id)) {
        return list;
      }

      const nextCards = [
        ...list.cards,
        buildInlineCreatedCard({
          description: params.card.description,
          id: params.card.id,
          listId: params.card.listId,
          position: params.card.position,
          title: params.card.title,
        }),
      ].sort((left, right) => left.position - right.position);

      return {
        ...list,
        cards: nextCards,
      };
    }),
  };
}
