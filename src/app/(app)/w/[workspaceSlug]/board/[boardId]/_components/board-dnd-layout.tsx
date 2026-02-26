"use client";

import {
  DndContext,
  DragOverlay,
  type SensorDescriptor,
  type SensorOptions,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation } from "@tanstack/react-query";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { toast } from "sonner";

import { Input, SubmitButton } from "@/components/ui";

import { createListInline } from "../actions.list.inline";
import type { LabelRecord, ListWithCards, WorkspaceMemberRecord, WorkspaceRole } from "../types";

import type { BoardOptimisticChange } from "./board-dnd-helpers";
import { type PresenceUser } from "./board-realtime";
import { SortableListColumn } from "./sortable-list-column";
import { cn } from "@/shared";

type BoardDndLayoutProps = {
  activeCardId: string | null;
  boardId: string;
  boardName: string;
  boardVersion: number;
  canCommentBoard: boolean;
  filterNotice: string | null;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragStart: (event: DragStartEvent) => void;
  isBoardInteractionLocked: boolean;
  isPointerInteractionLocked: boolean;
  listIds: string[];
  lists: ListWithCards[];
  loadMoreStep: number;
  membershipRole: WorkspaceRole;
  notice: string | null;
  onCardModalStateChange: (cardId: string, isOpen: boolean) => void;
  onCreateList: (payload: { id: string; position: number; title: string }) => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  readOnly: boolean;
  onLoadMoreCards: (listId: string) => void;
  overlayLabel: string;
  presenceUsers: PresenceUser[];
  sensors: SensorDescriptor<SensorOptions>[];
  showCardCoverOnFront: boolean;
  showCompleteStatusOnFront: boolean;
  visibleCardCountByList: Record<string, number>;
  viewerId: string;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

function NoticeToaster({ message }: { message: string | null }) {
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!message || message === lastMessageRef.current) {
      return;
    }

    lastMessageRef.current = message;
    if (message.toLowerCase().includes("failed")) {
      toast.error(message);
      return;
    }

    if (message.toLowerCase().includes("read-only")) {
      toast.info(message);
    }
  }, [message]);

  return null;
}

function AddListLane({
  boardId,
  onCreateList,
  workspaceSlug,
}: {
  boardId: string;
  onCreateList: (payload: { id: string; position: number; title: string }) => void;
  workspaceSlug: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const createListMutation = useMutation({
    mutationFn: async (payload: {
      boardId: string;
      title: string;
      workspaceSlug: string;
    }) => createListInline(payload),
    onError: () => {
      toast.error("Không thể tạo danh sách.");
    },
    onSuccess: (result) => {
      if (!result.ok || !result.list) {
        toast.error(result.error ?? "Không thể tạo danh sách.");
        return;
      }

      onCreateList(result.list);
      setTitle("");
      setIsOpen(false);
      toast.success("Đã tạo danh sách mới.");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createListMutation.isPending) {
      return;
    }

    const sanitizedTitle = title.trim();
    if (sanitizedTitle.length < 1) {
      toast.error("List title is required.");
      return;
    }

    createListMutation.mutate({
      boardId,
      title: sanitizedTitle,
      workspaceSlug,
    });
  };

  return (
    <details
      onToggle={(event) => {
        setIsOpen((event.currentTarget as HTMLDetailsElement).open);
      }}
      open={isOpen}
      className="w-[292px] shrink-0 snap-start rounded-xl border border-white/10 bg-gray-900/50 p-2.5 backdrop-blur-md"
      data-lane-pan-stop
      data-shortcut-add-list-container
    >
      <summary
        className="cursor-pointer list-none rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800/70"
        onClick={(event) => {
          event.preventDefault();
          setIsOpen((currentValue) => !currentValue);
        }}
      >
        + Add another list
      </summary>
      <form className="mt-2 space-y-2 rounded-lg border border-white/10 bg-slate-950/60 p-2.5" onSubmit={handleSubmit}>
        <Input
          className="min-h-9 border-slate-600 bg-slate-900/80 text-sm text-slate-100 placeholder:text-slate-400"
          disabled={createListMutation.isPending}
          maxLength={200}
          minLength={1}
          name="title"
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          placeholder="Enter lane title..."
          required
          value={title}
        />
        <SubmitButton
          className="min-h-9 w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={createListMutation.isPending}
        >
          {createListMutation.isPending ? "Adding list..." : "Add list"}
        </SubmitButton>
      </form>
    </details>
  );
}

type BoardListsLaneProps = {
  activeCardId: string | null;
  boardId: string;
  boardName: string;
  canCommentBoard: boolean;
  isBoardInteractionLocked: boolean;
  listOptions: Array<{ id: string; title: string }>;
  lists: ListWithCards[];
  loadMoreStep: number;
  membershipRole: WorkspaceRole;
  onCardModalStateChange: (cardId: string, isOpen: boolean) => void;
  onCreateList: (payload: { id: string; position: number; title: string }) => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onLoadMoreCards: (listId: string) => void;
  presenceUsers: PresenceUser[];
  readOnly: boolean;
  showCardCoverOnFront: boolean;
  showCompleteStatusOnFront: boolean;
  viewerId: string;
  visibleCardCountByList: Record<string, number>;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

function useLaneGrabScroll(disabled: boolean) {
  const laneScrollRef = useRef<HTMLDivElement | null>(null);
  const [isLanePanning, setIsLanePanning] = useState(false);
  const panStateRef = useRef({
    active: false,
    pointerId: -1,
    startClientX: 0,
    startScrollLeft: 0,
  });

  const finishLanePan = useCallback((pointerId?: number) => {
    if (!panStateRef.current.active) {
      return;
    }

    const laneNode = laneScrollRef.current;
    if (laneNode && typeof pointerId === "number" && laneNode.hasPointerCapture(pointerId)) {
      laneNode.releasePointerCapture(pointerId);
    }

    panStateRef.current.active = false;
    panStateRef.current.pointerId = -1;
    setIsLanePanning(false);
  }, []);

  const handleLanePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const laneNode = laneScrollRef.current;
    if (!laneNode) {
      return;
    }

    const target = event.target as HTMLElement;
    if (
      target.closest(
        "[data-lane-pan-stop],button,a,input,textarea,select,label,[role='button'],[contenteditable='true']",
      )
    ) {
      return;
    }

    panStateRef.current.active = true;
    panStateRef.current.pointerId = event.pointerId;
    panStateRef.current.startClientX = event.clientX;
    panStateRef.current.startScrollLeft = laneNode.scrollLeft;
    laneNode.setPointerCapture(event.pointerId);
    setIsLanePanning(true);
    event.preventDefault();
  }, [disabled]);

  const handleLanePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      finishLanePan(event.pointerId);
      return;
    }

    if (!panStateRef.current.active) {
      return;
    }

    const laneNode = laneScrollRef.current;
    if (!laneNode) {
      return;
    }

    const horizontalDelta = event.clientX - panStateRef.current.startClientX;
    laneNode.scrollLeft = panStateRef.current.startScrollLeft - horizontalDelta;
  }, [disabled, finishLanePan]);

  const handleLanePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    finishLanePan(event.pointerId);
  }, [finishLanePan]);

  return {
    handleLanePointerDown,
    handleLanePointerMove,
    handleLanePointerUp,
    isLanePanning,
    laneScrollRef,
  };
}

function BoardListsLane({
  activeCardId,
  boardId,
  boardName,
  canCommentBoard,
  isBoardInteractionLocked,
  listOptions,
  lists,
  loadMoreStep,
  membershipRole,
  onCardModalStateChange,
  onCreateList,
  onOptimisticBoardChange,
  onLoadMoreCards,
  presenceUsers,
  readOnly,
  showCardCoverOnFront,
  showCompleteStatusOnFront,
  viewerId,
  visibleCardCountByList,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: BoardListsLaneProps) {
  const { handleLanePointerDown, handleLanePointerMove, handleLanePointerUp, isLanePanning, laneScrollRef } = useLaneGrabScroll(isBoardInteractionLocked);

  return (
    <div
      className={`board-lane-scroll w-full overflow-x-auto overflow-y-hidden ${
        isBoardInteractionLocked
          ? "cursor-default"
          : isLanePanning
            ? "cursor-grabbing select-none"
            : "cursor-grab"
      }`}
      onLostPointerCapture={handleLanePointerUp}
      onPointerCancel={handleLanePointerUp}
      onPointerDown={handleLanePointerDown}
      onPointerMove={handleLanePointerMove}
      onPointerUp={handleLanePointerUp}
      ref={laneScrollRef}
    >
      <div className="flex h-[calc(100dvh-14rem)] w-max min-w-full md:h-[calc(100dvh-13rem)] snap-x snap-mandatory scroll-smooth items-start gap-4 pb-3 pr-2">
        {lists.map((list, index) => (
          <SortableListColumn
            activeCardId={activeCardId}
            boardId={boardId}
            boardName={boardName}
            canCommentBoard={canCommentBoard}
            key={list.id}
            list={list}
            listIndex={index}
            listOptions={listOptions}
            loadMoreStep={loadMoreStep}
            membershipRole={membershipRole}
            onCardModalStateChange={onCardModalStateChange}
            onOptimisticBoardChange={onOptimisticBoardChange}
            onLoadMoreCards={onLoadMoreCards}
            presenceUsers={presenceUsers}
            readOnly={readOnly}
            showCardCoverOnFront={showCardCoverOnFront}
            showCompleteStatusOnFront={showCompleteStatusOnFront}
            isBoardInteractionLocked={isBoardInteractionLocked}
            visibleCardCount={visibleCardCountByList[list.id] ?? list.cards.length}
            viewerId={viewerId}
            workspaceLabels={workspaceLabels}
            workspaceMembers={workspaceMembers}
            workspaceSlug={workspaceSlug}
          />
        ))}
        {!readOnly ? <AddListLane boardId={boardId} onCreateList={onCreateList} workspaceSlug={workspaceSlug} /> : null}
        {lists.length === 0 ? (
          <m.div
            animate={{ opacity: 1, scale: 1 }}
            className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/30 bg-gray-900/50 p-8 text-center backdrop-blur-md"
            initial={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/30 bg-slate-900/70 text-slate-100">
              <span aria-hidden="true" className="text-2xl leading-none">□</span>
            </div>
            <p className="text-base font-semibold text-white">
              This board is empty. Drag cards here or create one!
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {readOnly ? "Waiting for teammates to add lists and cards." : "Press N to create a list, then C to add your first card."}
            </p>
          </m.div>
        ) : null}
      </div>
    </div>
  );
}

export function BoardDndLayout({
  activeCardId,
  boardId,
  boardName,
  canCommentBoard,
  filterNotice,
  handleDragEnd,
  handleDragStart,
  isBoardInteractionLocked,
  isPointerInteractionLocked,
  listIds,
  lists,
  loadMoreStep,
  membershipRole,
  notice,
  onCardModalStateChange,
  onCreateList,
  onOptimisticBoardChange,
  readOnly,
  onLoadMoreCards,
  overlayLabel,
  presenceUsers,
  sensors,
  showCardCoverOnFront,
  showCompleteStatusOnFront,
  visibleCardCountByList,
  viewerId,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: BoardDndLayoutProps) {
  const listOptions = useMemo(() => lists.map((list) => ({ id: list.id, title: list.title })), [lists]);

  return (
    <LazyMotion features={domAnimation}>
      <m.section
        animate={{ opacity: 1 }}
        aria-label="Kanban board"
        className={cn(
          "board-no-text-selection space-y-3 rounded-2xl p-2.5 text-white",
          isPointerInteractionLocked ? "pointer-events-none" : "",
        )}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {filterNotice ? (
          <p className="rounded-xl border border-sky-300/35 bg-sky-900/20 px-3 py-2 text-xs text-sky-100">
            {filterNotice}
          </p>
        ) : null}

        {readOnly ? (
          <p className="rounded-xl border border-amber-300/35 bg-amber-900/15 px-3 py-2 text-xs text-amber-100">
            You can view cards in this board, but list/card edits are disabled.
          </p>
        ) : null}

        <DndContext
          id={`board-dnd-${boardId}`}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
          sensors={sensors}
        >
          <SortableContext
            id={`board-lists-${boardId}`}
            items={listIds}
            strategy={horizontalListSortingStrategy}
          >
            <BoardListsLane
              activeCardId={activeCardId}
              boardId={boardId}
              boardName={boardName}
              canCommentBoard={canCommentBoard}
              isBoardInteractionLocked={isBoardInteractionLocked}
              listOptions={listOptions}
              lists={lists}
              loadMoreStep={loadMoreStep}
              membershipRole={membershipRole}
              onCardModalStateChange={onCardModalStateChange}
              onCreateList={onCreateList}
              onOptimisticBoardChange={onOptimisticBoardChange}
              onLoadMoreCards={onLoadMoreCards}
              presenceUsers={presenceUsers}
              readOnly={readOnly}
              showCardCoverOnFront={showCardCoverOnFront}
              showCompleteStatusOnFront={showCompleteStatusOnFront}
              viewerId={viewerId}
              visibleCardCountByList={visibleCardCountByList}
              workspaceLabels={workspaceLabels}
              workspaceMembers={workspaceMembers}
              workspaceSlug={workspaceSlug}
            />
          </SortableContext>

          <DragOverlay>
            {overlayLabel ? (
              <div className="z-50 max-w-[280px] rotate-2 scale-105 rounded-xl border border-cyan-300/45 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-slate-100 backdrop-blur-md">
                {overlayLabel}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        <NoticeToaster message={notice} />
      </m.section>
    </LazyMotion>
  );
}
