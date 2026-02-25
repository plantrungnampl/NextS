"use client";

import {
  type DragEndEvent,
  type DragStartEvent,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";

import type {
  LabelRecord,
  ListWithCards,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "../types";

import type { BoardOptimisticChange } from "./board-dnd-helpers";
import { BoardDndLayout } from "./board-dnd-layout";
import type { PresenceUser } from "./board-realtime";

type BoardCanvasLayoutProps = {
  activeCardId: string | null;
  boardId: string;
  boardName: string;
  boardVersion: number;
  filterNotice: string | null;
  handleCardModalStateChange: (cardId: string, isOpen: boolean) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragStart: (event: DragStartEvent) => void;
  isBoardInteractionLocked: boolean;
  isPointerInteractionLocked: boolean;
  isReadOnly: boolean;
  listIds: string[];
  lists: ListWithCards[];
  loadMoreStep: number;
  membershipRole: WorkspaceRole;
  notice: string | null;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onCreateList: (payload: { id: string; position: number; title: string }) => void;
  onLoadMoreCards: (listId: string) => void;
  overlayLabel: string;
  presenceUsers: PresenceUser[];
  sensors: SensorDescriptor<SensorOptions>[];
  showCardCoverOnFront: boolean;
  showCompleteStatusOnFront: boolean;
  viewerId: string;
  visibleCardCountByList: Record<string, number>;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

export function BoardCanvasLayout({
  activeCardId,
  boardId,
  boardName,
  boardVersion,
  filterNotice,
  handleCardModalStateChange,
  handleDragEnd,
  handleDragStart,
  isBoardInteractionLocked,
  isPointerInteractionLocked,
  isReadOnly,
  listIds,
  lists,
  loadMoreStep,
  membershipRole,
  notice,
  onCreateList,
  onOptimisticBoardChange,
  onLoadMoreCards,
  overlayLabel,
  presenceUsers,
  sensors,
  showCardCoverOnFront,
  showCompleteStatusOnFront,
  viewerId,
  visibleCardCountByList,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: BoardCanvasLayoutProps) {
  return (
    <BoardDndLayout
      activeCardId={activeCardId}
      boardId={boardId}
      boardName={boardName}
      boardVersion={boardVersion}
      filterNotice={filterNotice}
      handleDragEnd={handleDragEnd}
      handleDragStart={handleDragStart}
      isBoardInteractionLocked={isBoardInteractionLocked}
      isPointerInteractionLocked={isPointerInteractionLocked}
      listIds={listIds}
      lists={lists}
      loadMoreStep={loadMoreStep}
      membershipRole={membershipRole}
      notice={notice}
      onCreateList={onCreateList}
      onCardModalStateChange={handleCardModalStateChange}
      onOptimisticBoardChange={onOptimisticBoardChange}
      onLoadMoreCards={onLoadMoreCards}
      overlayLabel={overlayLabel}
      presenceUsers={presenceUsers}
      readOnly={isReadOnly}
      sensors={sensors}
      showCardCoverOnFront={showCardCoverOnFront}
      showCompleteStatusOnFront={showCompleteStatusOnFront}
      viewerId={viewerId}
      visibleCardCountByList={visibleCardCountByList}
      workspaceLabels={workspaceLabels}
      workspaceMembers={workspaceMembers}
      workspaceSlug={workspaceSlug}
    />
  );
}
