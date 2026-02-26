"use client";

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { memo, useMemo } from "react";

import { Card } from "@/components/ui";
import { cn } from "@/shared";

import type {
  LabelRecord,
  ListWithCards,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "../types";
import { cardDragId, listDragId, type BoardOptimisticChange, type DragData } from "./board-dnd-helpers";
import type { PresenceUser } from "./board-realtime";
import { AddCardForm, ListColumnHeader, ListColumnMetaRow } from "./sortable-list-column-parts";
import { ListDropZone, SortableCard } from "./sortable-list-card";

const laneDotColors = [
  "bg-emerald-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-sky-400",
  "bg-cyan-400",
  "bg-lime-400",
] as const;

type ListCardsProps = {
  activeCardId: string | null;
  boardId: string;
  boardName: string;
  canCommentBoard: boolean;
  cardIds: string[];
  isBoardInteractionLocked: boolean;
  list: ListWithCards;
  listOptions: Array<{ id: string; title: string }>;
  membershipRole: WorkspaceRole;
  onCardModalStateChange: (cardId: string, isOpen: boolean) => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  presenceUsers: PresenceUser[];
  readOnly: boolean;
  showCardCoverOnFront: boolean;
  showCompleteStatusOnFront: boolean;
  viewerId: string;
  visibleCards: ListWithCards["cards"];
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

function ListCards({
  activeCardId,
  boardId,
  boardName,
  canCommentBoard,
  cardIds,
  isBoardInteractionLocked,
  list,
  listOptions,
  membershipRole,
  onCardModalStateChange,
  onOptimisticBoardChange,
  presenceUsers,
  readOnly,
  showCardCoverOnFront,
  showCompleteStatusOnFront,
  viewerId,
  visibleCards,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: ListCardsProps) {
  return (
    <LazyMotion features={domAnimation}>
      <SortableContext
        id={`board-cards-${list.id}`}
        items={cardIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {visibleCards.map((card) => (
            <m.div
              key={card.id}
              layout
              transition={{ damping: 28, stiffness: 360, type: "spring" }}
            >
              <SortableCard
                activeCardId={activeCardId}
                boardId={boardId}
                boardName={boardName}
                canCommentBoard={canCommentBoard}
                card={card}
                isBoardInteractionLocked={isBoardInteractionLocked}
                listId={list.id}
                listOptions={listOptions}
                membershipRole={membershipRole}
                onModalStateChange={onCardModalStateChange}
                onOptimisticBoardChange={onOptimisticBoardChange}
                presenceUsers={presenceUsers}
                readOnly={readOnly}
                showCardCoverOnFront={showCardCoverOnFront}
                showCompleteStatusOnFront={showCompleteStatusOnFront}
                viewerId={viewerId}
                workspaceLabels={workspaceLabels}
                workspaceMembers={workspaceMembers}
                workspaceSlug={workspaceSlug}
              />
            </m.div>
          ))}
          {!readOnly ? <ListDropZone isEmpty={list.cards.length === 0} listId={list.id} /> : null}
        </div>
      </SortableContext>
    </LazyMotion>
  );
}

// eslint-disable-next-line max-lines-per-function
function SortableListColumnImpl({
  activeCardId,
  boardId,
  boardName,
  canCommentBoard,
  isBoardInteractionLocked,
  list,
  listIndex,
  listOptions,
  loadMoreStep,
  membershipRole,
  onCardModalStateChange,
  onOptimisticBoardChange,
  onLoadMoreCards,
  presenceUsers,
  readOnly,
  showCardCoverOnFront,
  showCompleteStatusOnFront,
  visibleCardCount,
  viewerId,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: {
  activeCardId: string | null;
  boardId: string;
  boardName: string;
  canCommentBoard: boolean;
  isBoardInteractionLocked: boolean;
  list: ListWithCards;
  listIndex: number;
  listOptions: Array<{ id: string; title: string }>;
  loadMoreStep: number;
  membershipRole: WorkspaceRole;
  onCardModalStateChange: (cardId: string, isOpen: boolean) => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onLoadMoreCards: (listId: string) => void;
  presenceUsers: PresenceUser[];
  readOnly: boolean;
  showCardCoverOnFront: boolean;
  showCompleteStatusOnFront: boolean;
  visibleCardCount: number;
  viewerId: string;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    data: {
      listId: list.id,
      type: "list",
    } satisfies DragData,
    disabled: readOnly || isBoardInteractionLocked,
    id: listDragId(list.id),
  });
  const normalizedVisibleCardCount = Math.max(0, Math.min(visibleCardCount, list.cards.length));
  const visibleCards = useMemo(
    () => list.cards.slice(0, normalizedVisibleCardCount),
    [list.cards, normalizedVisibleCardCount],
  );
  const cardIds = useMemo(() => visibleCards.map((card) => cardDragId(card.id)), [visibleCards]);
  const hiddenCardCount = Math.max(0, list.cards.length - visibleCards.length);
  const laneDotClass = laneDotColors[listIndex % laneDotColors.length] ?? "bg-slate-300";

  return (
    <Card
      className={cn(
        "flex w-[292px] shrink-0 snap-start flex-col rounded-xl border border-white/12 !bg-gray-900/50 p-2.5 backdrop-blur-md",
        "min-h-[18rem] max-h-[calc(100dvh-20rem)] sm:min-h-[20rem] sm:max-h-[calc(100dvh-18rem)] md:min-h-[22rem] md:max-h-[calc(100dvh-16rem)] xl:max-h-[calc(100dvh-14rem)]",
        isDragging ? "opacity-85 ring-2 ring-cyan-300/70" : "",
      )}
      data-lane-pan-stop
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className="mb-2 rounded-md px-1 py-1">
        <ListColumnHeader
          attributes={attributes}
          boardId={boardId}
          listeners={listeners}
          laneColorClass={laneDotClass}
          listId={list.id}
          readOnly={readOnly}
          subtitle={null}
          title={list.title}
          workspaceSlug={workspaceSlug}
        />
        <ListColumnMetaRow
          hiddenCardCount={hiddenCardCount}
          listId={list.id}
          loadMoreStep={loadMoreStep}
          onLoadMoreCards={onLoadMoreCards}
          totalCount={list.cards.length}
          visibleCount={visibleCards.length}
        />
      </div>

      <div className="board-column-scroll min-h-0 flex-1 overflow-y-auto px-1">
        <ListCards
          activeCardId={activeCardId}
          boardId={boardId}
          boardName={boardName}
          canCommentBoard={canCommentBoard}
          cardIds={cardIds}
          isBoardInteractionLocked={isBoardInteractionLocked}
          list={list}
          listOptions={listOptions}
          membershipRole={membershipRole}
          onCardModalStateChange={onCardModalStateChange}
          onOptimisticBoardChange={onOptimisticBoardChange}
          presenceUsers={presenceUsers}
          readOnly={readOnly}
          showCardCoverOnFront={showCardCoverOnFront}
          showCompleteStatusOnFront={showCompleteStatusOnFront}
          viewerId={viewerId}
          visibleCards={visibleCards}
          workspaceLabels={workspaceLabels}
          workspaceMembers={workspaceMembers}
          workspaceSlug={workspaceSlug}
        />
      </div>

      {!readOnly ? (
        <AddCardForm
          boardId={boardId}
          emphasize={visibleCards.length === 0}
          listId={list.id}
          workspaceSlug={workspaceSlug}
        />
      ) : null}
    </Card>
  );
}

export const SortableListColumn = memo(
  SortableListColumnImpl,
  (prevProps, nextProps) =>
    prevProps.activeCardId === nextProps.activeCardId &&
    prevProps.boardId === nextProps.boardId &&
    prevProps.boardName === nextProps.boardName &&
    prevProps.canCommentBoard === nextProps.canCommentBoard &&
    prevProps.isBoardInteractionLocked === nextProps.isBoardInteractionLocked &&
    prevProps.list === nextProps.list &&
    prevProps.listIndex === nextProps.listIndex &&
    prevProps.listOptions === nextProps.listOptions &&
    prevProps.loadMoreStep === nextProps.loadMoreStep &&
    prevProps.membershipRole === nextProps.membershipRole &&
    prevProps.onCardModalStateChange === nextProps.onCardModalStateChange &&
    prevProps.onOptimisticBoardChange === nextProps.onOptimisticBoardChange &&
    prevProps.onLoadMoreCards === nextProps.onLoadMoreCards &&
    prevProps.presenceUsers === nextProps.presenceUsers &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.showCardCoverOnFront === nextProps.showCardCoverOnFront &&
    prevProps.showCompleteStatusOnFront === nextProps.showCompleteStatusOnFront &&
    prevProps.visibleCardCount === nextProps.visibleCardCount &&
    prevProps.viewerId === nextProps.viewerId &&
    prevProps.workspaceLabels === nextProps.workspaceLabels &&
    prevProps.workspaceMembers === nextProps.workspaceMembers &&
    prevProps.workspaceSlug === nextProps.workspaceSlug,
);
