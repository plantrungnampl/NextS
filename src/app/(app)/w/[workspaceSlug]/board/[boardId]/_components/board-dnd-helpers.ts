import { arrayMove } from "@dnd-kit/sortable";

import type { CardRecord, ListWithCards } from "../types";
import { positionFromIndex } from "../utils";

export type DragData =
  | {
      listId: string;
      type: "list";
    }
  | {
      cardId: string;
      listId: string;
      type: "card";
    }
  | {
      listId: string;
      type: "list-drop";
    };

export type CardDropTarget = {
  cardId?: string;
  listId: string;
};

export type BoardOptimisticChange =
  | {
      cardId: string;
      targetListId: string;
      targetPositionIndex?: number | null;
      type: "move-card";
    }
  | {
      cardId: string;
      type: "remove-card";
    }
  | {
      copiedCardId: string;
      copiedTitle?: string;
      includeAttachments: boolean;
      includeChecklist: boolean;
      includeCustomFields: boolean;
      includeMembers: boolean;
      sourceCard: CardRecord;
      targetListId: string;
      targetPositionIndex?: number | null;
      type: "insert-copied-card";
    };

const LIST_PREFIX = "list:";
const CARD_PREFIX = "card:";
const DROP_PREFIX = "drop:";

export function listDragId(listId: string): string {
  return `${LIST_PREFIX}${listId}`;
}

export function cardDragId(cardId: string): string {
  return `${CARD_PREFIX}${cardId}`;
}

export function dropZoneId(listId: string): string {
  return `${DROP_PREFIX}${listId}`;
}

export function isDragData(value: unknown): value is DragData {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }

  const type = (value as { type?: string }).type;
  return type === "list" || type === "card" || type === "list-drop";
}

export function getDropTarget(overData: DragData | null): CardDropTarget | null {
  if (!overData) {
    return null;
  }

  if (overData.type === "card") {
    return {
      cardId: overData.cardId,
      listId: overData.listId,
    };
  }

  return {
    listId: overData.listId,
  };
}

export function reorderListsLocally(
  lists: ListWithCards[],
  activeListId: string,
  overListId: string,
): ListWithCards[] {
  const activeIndex = lists.findIndex((list) => list.id === activeListId);
  const overIndex = lists.findIndex((list) => list.id === overListId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return lists;
  }

  return arrayMove(lists, activeIndex, overIndex);
}

function reorderCardsInSameList(
  cards: CardRecord[],
  activeCardId: string,
  overCardId?: string,
): CardRecord[] {
  const activeIndex = cards.findIndex((card) => card.id === activeCardId);
  const computedOverIndex = overCardId
    ? cards.findIndex((card) => card.id === overCardId)
    : cards.length - 1;
  const overIndex = computedOverIndex >= 0 ? computedOverIndex : cards.length - 1;

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return cards;
  }

  return arrayMove(cards, activeIndex, overIndex).map((card, index) => ({
    ...card,
    position: positionFromIndex(index),
  }));
}

function moveCardAcrossLists(
  lists: ListWithCards[],
  activeCardId: string,
  sourceListId: string,
  targetListId: string,
  overCardId?: string,
): ListWithCards[] {
  const sourceListIndex = lists.findIndex((list) => list.id === sourceListId);
  const targetListIndex = lists.findIndex((list) => list.id === targetListId);

  if (sourceListIndex < 0 || targetListIndex < 0) {
    return lists;
  }

  const sourceCards = [...lists[sourceListIndex].cards];
  const activeIndex = sourceCards.findIndex((card) => card.id === activeCardId);

  if (activeIndex < 0) {
    return lists;
  }

  const [movedCard] = sourceCards.splice(activeIndex, 1);
  const targetCards = [...lists[targetListIndex].cards];
  const computedInsertIndex = overCardId
    ? targetCards.findIndex((card) => card.id === overCardId)
    : targetCards.length;
  const insertIndex = computedInsertIndex >= 0 ? computedInsertIndex : targetCards.length;

  targetCards.splice(insertIndex, 0, {
    ...movedCard,
    list_id: targetListId,
  });

  const nextSourceCards = sourceCards.map((card, index) => ({
    ...card,
    list_id: sourceListId,
    position: positionFromIndex(index),
  }));

  const nextTargetCards = targetCards.map((card, index) => ({
    ...card,
    list_id: targetListId,
    position: positionFromIndex(index),
  }));

  const nextLists = [...lists];
  nextLists[sourceListIndex] = {
    ...lists[sourceListIndex],
    cards: nextSourceCards,
  };
  nextLists[targetListIndex] = {
    ...lists[targetListIndex],
    cards: nextTargetCards,
  };

  return nextLists;
}

export function moveCardLocally(
  lists: ListWithCards[],
  activeCardId: string,
  sourceListId: string,
  targetListId: string,
  overCardId?: string,
): ListWithCards[] {
  if (sourceListId === targetListId) {
    return lists.map((list) => {
      if (list.id !== sourceListId) {
        return list;
      }

      return {
        ...list,
        cards: reorderCardsInSameList(list.cards, activeCardId, overCardId),
      };
    });
  }

  return moveCardAcrossLists(lists, activeCardId, sourceListId, targetListId, overCardId);
}

function clampInsertionIndex(cardCount: number, targetPositionIndex?: number | null): number {
  if (typeof targetPositionIndex !== "number" || !Number.isFinite(targetPositionIndex)) {
    return cardCount;
  }

  const normalized = Math.trunc(targetPositionIndex);
  if (normalized <= 1) {
    return 0;
  }
  if (normalized > cardCount) {
    return cardCount;
  }

  return normalized - 1;
}

function normalizeListCards(cards: CardRecord[], listId: string): CardRecord[] {
  return cards.map((card, index) => ({
    ...card,
    list_id: listId,
    position: positionFromIndex(index),
  }));
}

type RemoveCardResult = {
  fromListId: string | null;
  nextLists: ListWithCards[];
  removedCard: CardRecord | null;
};

function removeCardFromLists(lists: ListWithCards[], cardId: string): RemoveCardResult {
  for (const [listIndex, list] of lists.entries()) {
    const cardIndex = list.cards.findIndex((entry) => entry.id === cardId);
    if (cardIndex < 0) {
      continue;
    }

    const nextCards = [...list.cards];
    const [removedCard] = nextCards.splice(cardIndex, 1);
    const normalizedCards = normalizeListCards(nextCards, list.id);
    const nextLists = [...lists];
    nextLists[listIndex] = {
      ...list,
      cards: normalizedCards,
    };
    return {
      fromListId: list.id,
      nextLists,
      removedCard: removedCard ?? null,
    };
  }

  return {
    fromListId: null,
    nextLists: lists,
    removedCard: null,
  };
}

function insertCardIntoList(params: {
  card: CardRecord;
  lists: ListWithCards[];
  targetListId: string;
  targetPositionIndex?: number | null;
}): ListWithCards[] {
  const targetListIndex = params.lists.findIndex((list) => list.id === params.targetListId);
  if (targetListIndex < 0) {
    return params.lists;
  }

  const targetList = params.lists[targetListIndex];
  const nextCards = targetList.cards.filter((entry) => entry.id !== params.card.id);
  const insertIndex = clampInsertionIndex(nextCards.length, params.targetPositionIndex);
  nextCards.splice(insertIndex, 0, {
    ...params.card,
    list_id: params.targetListId,
  });
  const normalizedCards = normalizeListCards(nextCards, params.targetListId);
  const nextLists = [...params.lists];
  nextLists[targetListIndex] = {
    ...targetList,
    cards: normalizedCards,
  };
  return nextLists;
}

export function removeCardLocally(
  lists: ListWithCards[],
  cardId: string,
): ListWithCards[] {
  return removeCardFromLists(lists, cardId).nextLists;
}

export function moveCardByPositionLocally(params: {
  cardId: string;
  lists: ListWithCards[];
  targetListId: string;
  targetPositionIndex?: number | null;
}): ListWithCards[] {
  const targetListExists = params.lists.some((list) => list.id === params.targetListId);
  if (!targetListExists) {
    return params.lists;
  }

  const { removedCard, nextLists } = removeCardFromLists(params.lists, params.cardId);
  if (!removedCard) {
    return params.lists;
  }

  return insertCardIntoList({
    card: removedCard,
    lists: nextLists,
    targetListId: params.targetListId,
    targetPositionIndex: params.targetPositionIndex,
  });
}

function buildOptimisticCopiedCard(params: {
  copiedCardId: string;
  copiedTitle?: string;
  includeAttachments: boolean;
  includeChecklist: boolean;
  includeCustomFields: boolean;
  includeMembers: boolean;
  sourceCard: CardRecord;
  targetListId: string;
}): CardRecord {
  const normalizedTitle = params.copiedTitle?.trim();
  const sourceCard = params.sourceCard;

  return {
    ...sourceCard,
    assignees: params.includeMembers ? [...sourceCard.assignees] : [],
    attachmentCount: params.includeAttachments
      ? (sourceCard.attachmentCount ?? sourceCard.attachments.length)
      : 0,
    attachments: params.includeAttachments ? [...sourceCard.attachments] : [],
    checklistCompletedCount: params.includeChecklist
      ? (sourceCard.checklistCompletedCount ?? 0)
      : 0,
    checklistTotalCount: params.includeChecklist
      ? (sourceCard.checklistTotalCount ?? 0)
      : 0,
    commentCount: 0,
    comments: [],
    effort: params.includeCustomFields ? sourceCard.effort : null,
    id: params.copiedCardId,
    labels: [...sourceCard.labels],
    list_id: params.targetListId,
    position: 0,
    priority: params.includeCustomFields ? sourceCard.priority : null,
    status: params.includeCustomFields ? sourceCard.status : null,
    title:
      normalizedTitle && normalizedTitle.length > 0
        ? normalizedTitle
        : `Copy of ${sourceCard.title}`,
    watchCount: 0,
    watchedByViewer: false,
  };
}

export function applyBoardOptimisticChange(
  lists: ListWithCards[],
  change: BoardOptimisticChange,
): ListWithCards[] {
  if (change.type === "move-card") {
    return moveCardByPositionLocally({
      cardId: change.cardId,
      lists,
      targetListId: change.targetListId,
      targetPositionIndex: change.targetPositionIndex,
    });
  }

  if (change.type === "remove-card") {
    return removeCardLocally(lists, change.cardId);
  }

  const optimisticCard = buildOptimisticCopiedCard({
    copiedCardId: change.copiedCardId,
    copiedTitle: change.copiedTitle,
    includeAttachments: change.includeAttachments,
    includeChecklist: change.includeChecklist,
    includeCustomFields: change.includeCustomFields,
    includeMembers: change.includeMembers,
    sourceCard: change.sourceCard,
    targetListId: change.targetListId,
  });
  return insertCardIntoList({
    card: optimisticCard,
    lists,
    targetListId: change.targetListId,
    targetPositionIndex: change.targetPositionIndex,
  });
}

export function getOverlayLabel(activeDragData: DragData | null, lists: ListWithCards[]): string {
  if (!activeDragData) {
    return "";
  }

  if (activeDragData.type === "list") {
    return lists.find((list) => list.id === activeDragData.listId)?.title ?? "Moving list";
  }

  if (activeDragData.type === "card") {
    const list = lists.find((item) => item.id === activeDragData.listId);
    return list?.cards.find((card) => card.id === activeDragData.cardId)?.title ?? "Moving card";
  }

  return "";
}
