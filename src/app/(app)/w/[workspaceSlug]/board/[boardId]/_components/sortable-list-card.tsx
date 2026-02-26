"use client";

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
} from "@/components/ui";
import { cn } from "@/shared";

import type {
  CardRecord,
  LabelRecord,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "../types";
import { updateCardCompletionInline } from "../actions.card-modal";
import {
  cardDragId,
  dropZoneId,
  type BoardOptimisticChange,
  type DragData,
} from "./board-dnd-helpers";
import { useCardModalPrefetch } from "./card-modal-prefetch";
import type { PresenceUser } from "./board-realtime";
import {
  descriptionToPlainText,
  getChecklistProgress,
} from "./card-ui-utils";
import { CardRichnessPanel } from "./card-richness-panel";
import { CardSummaryContent } from "./card-summary-content";

type CardPresenceUserView = {
  avatarUrl: string | null;
  colorClass: string;
  displayName: string;
  userId: string;
};

function presenceColorToHex(colorClass: string): string {
  if (colorClass.includes("emerald")) {
    return "#065f46";
  }

  if (colorClass.includes("amber")) {
    return "#78350f";
  }

  if (colorClass.includes("rose")) {
    return "#7f1d1d";
  }

  if (colorClass.includes("violet")) {
    return "#5b21b6";
  }

  return "#0c4a6e";
}

function CardPresenceIndicators({
  remoteActiveUsers,
  remoteDraggingNames,
}: {
  remoteActiveUsers: CardPresenceUserView[];
  remoteDraggingNames: string;
}) {
  return (
    <>
      {remoteDraggingNames ? (
        <div className="mb-2 inline-flex max-w-full items-center rounded-full border border-cyan-300/70 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
          <span className="truncate">{`${remoteDraggingNames} is dragging...`}</span>
        </div>
      ) : null}
      {remoteActiveUsers.length > 0 ? (
        <div className="absolute right-2 top-2 z-10 flex items-center -space-x-1">
          {remoteActiveUsers.slice(0, 3).map((user) => (
            <Avatar
              className="h-5 w-5 border border-slate-950"
              key={user.userId}
              title={`${user.displayName} is viewing`}
            >
              {user.avatarUrl ? <AvatarImage alt={user.displayName} src={user.avatarUrl} /> : null}
              <AvatarFallback
                className="text-[9px] text-slate-100"
                style={{ backgroundColor: presenceColorToHex(user.colorClass) }}
              >
                {user.displayName.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      ) : null}
    </>
  );
}

function useCardDisplayMetrics(card: CardRecord) {
  return useMemo(
    () => ({
      attachmentCount: card.attachmentCount ?? card.attachments.length,
      checklistProgress: getChecklistProgress(card),
      commentCount: card.commentCount ?? card.comments.length,
      descriptionPreview: descriptionToPlainText(card.description),
      remainingAssigneeCount: Math.max(0, card.assignees.length - 4),
    }),
    [card],
  );
}

function useSortableCardPresence({
  cardId,
  presenceUsers,
  viewerId,
  workspaceMembers,
}: {
  cardId: string;
  presenceUsers: PresenceUser[];
  viewerId: string;
  workspaceMembers: WorkspaceMemberRecord[];
}) {
  return useMemo(() => {
    const memberAvatarById = new Map(
      workspaceMembers.map((member) => [member.id, member.avatarUrl]),
    );
    const remoteActiveUsers = presenceUsers.filter(
      (user) => user.userId !== viewerId && user.activeCardId === cardId,
    );
    const remoteDraggingUsers = presenceUsers.filter(
      (user) => user.userId !== viewerId && user.draggingCardId === cardId,
    );

    return {
      remoteActiveUsersWithAvatar: remoteActiveUsers.map((user) => ({
        avatarUrl: memberAvatarById.get(user.userId) ?? null,
        colorClass: user.colorClass,
        displayName: user.displayName,
        userId: user.userId,
      })),
      remoteDraggingNames: remoteDraggingUsers
        .map((user) => user.displayName)
        .join(", "),
      shouldRenderGhost: remoteDraggingUsers.length > 0,
    };
  }, [cardId, presenceUsers, viewerId, workspaceMembers]);
}

export function ListDropZone({
  isEmpty,
  listId,
}: {
  isEmpty: boolean;
  listId: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    data: {
      listId,
      type: "list-drop",
    } satisfies DragData,
    id: dropZoneId(listId),
  });

  return (
    <div
      className={cn(
        "min-h-8 rounded-lg border border-dashed border-transparent px-2 py-1 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400 transition-colors",
        isEmpty ? "border-white/15 bg-slate-900/65 text-slate-300" : "",
        isOver ? "border-cyan-300 bg-cyan-500/20 text-cyan-100 opacity-80" : "",
      )}
      ref={setNodeRef}
    >
      {isEmpty ? "Drop card here" : null}
    </div>
  );
}

type SortableCardProps = {
  activeCardId: string | null;
  boardId: string;
  boardName: string;
  canCommentBoard: boolean;
  card: CardRecord;
  isBoardInteractionLocked: boolean;
  listId: string;
  listOptions: Array<{ id: string; title: string }>;
  membershipRole: WorkspaceRole;
  onModalStateChange: (cardId: string, isOpen: boolean) => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  presenceUsers: PresenceUser[];
  readOnly: boolean;
  showCardCoverOnFront: boolean;
  showCompleteStatusOnFront: boolean;
  viewerId: string;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

type CardOptimisticPatch = {
  assignees?: WorkspaceMemberRecord[];
  completed_at?: string | null;
  coverAttachmentId?: string | null;
  coverColor?: string | null;
  coverColorblindFriendly?: boolean;
  coverMode?: CardRecord["coverMode"];
  coverSize?: CardRecord["coverSize"];
  due_at?: string | null;
  effort?: string | null;
  has_due_time?: boolean;
  has_start_time?: boolean;
  is_completed?: boolean;
  is_template?: boolean;
  labels?: LabelRecord[];
  list_id?: string;
  priority?: string | null;
  recurrence_anchor_at?: string | null;
  recurrence_rrule?: string | null;
  recurrence_tz?: string | null;
  reminder_offset_minutes?: number | null;
  start_at?: string | null;
  status?: string | null;
  title?: string;
  watchCount?: number;
  watchedByViewer?: boolean;
};

function useOptimisticCard(card: CardRecord) {
  const [optimisticPatch, setOptimisticPatch] = useState<CardOptimisticPatch>({});
  const optimisticCard = useMemo(
    () => ({ ...card, ...optimisticPatch }),
    [card, optimisticPatch],
  );

  const applyPatch = (patch: CardOptimisticPatch) => {
    setOptimisticPatch((previous) => ({ ...previous, ...patch }));
  };

  return { applyPatch, optimisticCard };
}

function useCardCompletionPersistence(params: {
  applyPatch: (patch: CardOptimisticPatch) => void;
  boardId: string;
  card: Pick<CardRecord, "completed_at" | "id" | "is_completed">;
  readOnly: boolean;
  workspaceSlug: string;
}) {
  const [isPersistingCompletion, startPersistingCompletion] = useTransition();
  const completionMutationSequenceRef = useRef(0);
  const handleToggleComplete = (nextIsCompleted: boolean) => {
    if (params.readOnly) {
      return;
    }

    const previousState = {
      completed_at: params.card.completed_at ?? null,
      is_completed: params.card.is_completed,
    };
    params.applyPatch({
      completed_at: nextIsCompleted ? new Date().toISOString() : null,
      is_completed: nextIsCompleted,
    });

    const mutationSequence = completionMutationSequenceRef.current + 1;
    completionMutationSequenceRef.current = mutationSequence;
    const formData = new FormData();
    formData.set("boardId", params.boardId);
    formData.set("workspaceSlug", params.workspaceSlug);
    formData.set("cardId", params.card.id);
    formData.set("isCompleted", String(nextIsCompleted));

    startPersistingCompletion(() => {
      void (async () => {
        const result = await updateCardCompletionInline(formData);
        if (mutationSequence !== completionMutationSequenceRef.current || result.ok) {
          return;
        }

        params.applyPatch(previousState);
        toast.error(result.error ?? "Không thể cập nhật trạng thái hoàn tất.");
      })();
    });
  };

  return { handleToggleComplete, isPersistingCompletion };
}

function SortableCardBody(props: {
  applyPatch: (patch: CardOptimisticPatch) => void;
  attachmentCount: number;
  boardId: string;
  boardName: string;
  canCommentBoard: boolean;
  checklistProgress: { completed: number; total: number };
  commentCount: number;
  descriptionPreview: string;
  handleToggleComplete: (nextIsCompleted: boolean) => void;
  isModalOpen: boolean;
  isPersistingCompletion: boolean;
  listOptions: Array<{ id: string; title: string }>;
  membershipRole: WorkspaceRole;
  onClose: () => void;
  onOpen: () => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onOptimisticTitleChange: (nextTitle: string) => void;
  optimisticCard: CardRecord;
  readOnly: boolean;
  remainingAssigneeCount: number;
  remoteActiveUsersWithAvatar: CardPresenceUserView[];
  remoteDraggingNames: string;
  showCardCoverOnFront: boolean;
  showCompleteStatusOnFront: boolean;
  viewerId: string;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
}) {
  return (
    <>
      <CardPresenceIndicators
        remoteActiveUsers={props.remoteActiveUsersWithAvatar}
        remoteDraggingNames={props.remoteDraggingNames}
      />
      <div className="flex items-start gap-2">
        <CardSummaryContent
          attachmentCount={props.attachmentCount}
          boardId={props.boardId}
          canWrite={!props.readOnly}
          card={props.optimisticCard}
          checklistProgress={props.checklistProgress}
          commentCount={props.commentCount}
          descriptionPreview={props.descriptionPreview}
          isPersistingCompletion={props.isPersistingCompletion}
          onOpen={props.onOpen}
          onOptimisticTitleChange={props.onOptimisticTitleChange}
          onToggleComplete={props.handleToggleComplete}
          remainingAssigneeCount={props.remainingAssigneeCount}
          showCardCoverOnFront={props.showCardCoverOnFront}
          showCompleteStatusOnFront={props.showCompleteStatusOnFront}
          workspaceSlug={props.workspaceSlug}
        />
      </div>
      <CardRichnessPanel
        activeEditors={props.remoteActiveUsersWithAvatar}
        boardId={props.boardId}
        boardName={props.boardName}
        canCommentBoard={props.canCommentBoard}
        canWrite={!props.readOnly}
        card={props.optimisticCard}
        isOpen={props.isModalOpen}
        listOptions={props.listOptions}
        membershipRole={props.membershipRole}
        onClose={props.onClose}
        onOptimisticTitleChange={props.onOptimisticTitleChange}
        onToggleComplete={props.handleToggleComplete}
        onOptimisticBoardChange={props.onOptimisticBoardChange}
        onOptimisticCustomFieldsChange={props.applyPatch}
        viewerId={props.viewerId}
        workspaceLabels={props.workspaceLabels}
        workspaceMembers={props.workspaceMembers}
        workspaceSlug={props.workspaceSlug}
      />
    </>
  );
}

// eslint-disable-next-line max-lines-per-function
export function SortableCard({
  activeCardId,
  boardId,
  boardName,
  canCommentBoard,
  card,
  isBoardInteractionLocked,
  listId,
  listOptions,
  membershipRole,
  onModalStateChange,
  onOptimisticBoardChange,
  presenceUsers,
  readOnly,
  showCardCoverOnFront,
  showCompleteStatusOnFront,
  viewerId,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: SortableCardProps) {
  const { applyPatch, optimisticCard } = useOptimisticCard(card);
  const { handleToggleComplete, isPersistingCompletion } = useCardCompletionPersistence({
    applyPatch,
    boardId,
    card: optimisticCard,
    readOnly,
    workspaceSlug,
  });
  const {
    attributes,
    isDragging,
    isOver,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    data: {
      cardId: card.id,
      listId,
      type: "card",
    } satisfies DragData,
    disabled: readOnly || isBoardInteractionLocked,
    id: cardDragId(card.id),
  });
  const {
    attachmentCount,
    checklistProgress,
    commentCount,
    descriptionPreview,
    remainingAssigneeCount,
  } = useCardDisplayMetrics(optimisticCard);
  const {
    remoteActiveUsersWithAvatar,
    remoteDraggingNames,
    shouldRenderGhost,
  } = useSortableCardPresence({
    cardId: optimisticCard.id,
    presenceUsers,
    viewerId,
    workspaceMembers,
  });
  const transformedPosition = transform
    ? {
      ...transform,
      scaleX: isDragging ? 1.05 : transform.scaleX,
      scaleY: isDragging ? 1.05 : transform.scaleY,
    }
    : null;
  const transformValue = CSS.Transform.toString(transformedPosition);
  const isModalOpen = activeCardId === optimisticCard.id;
  const { cancelPrefetch, schedulePrefetch } = useCardModalPrefetch({
    boardId,
    cardId: optimisticCard.id,
    isModalOpen,
    workspaceSlug,
  });
  const openModal = () => onModalStateChange(optimisticCard.id, true);
  const closeModal = () => onModalStateChange(optimisticCard.id, false);
  return (
    <Card
      {...(!readOnly && !isBoardInteractionLocked ? { ...attributes, ...listeners } : {})}
      className={cn(
        "group/card relative rounded-xl border border-white/12 !bg-slate-900/80 p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/60",
        isOver && !isDragging ? "border-dashed border-cyan-300 opacity-80" : "",
        shouldRenderGhost && !isDragging
          ? "border-dashed border-cyan-300/80 opacity-75"
          : "",
        isDragging ? "z-50 cursor-grabbing ring-2 ring-cyan-300/70" : "",
      )}
      ref={setNodeRef}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) {
          return;
        }
        cancelPrefetch();
      }}
      onFocusCapture={() => {
        schedulePrefetch();
      }}
      onMouseEnter={() => {
        schedulePrefetch();
      }}
      onMouseLeave={() => {
        cancelPrefetch();
      }}
      style={{
        transform: isDragging && transformValue ? `${transformValue} rotate(2deg)` : transformValue,
        transition,
        zIndex: isDragging ? 50 : undefined,
      }}
    >
      <SortableCardBody
        applyPatch={applyPatch}
        attachmentCount={attachmentCount}
        boardId={boardId}
        boardName={boardName}
        canCommentBoard={canCommentBoard}
        checklistProgress={checklistProgress}
        commentCount={commentCount}
        descriptionPreview={descriptionPreview}
        handleToggleComplete={handleToggleComplete}
        isModalOpen={isModalOpen}
        isPersistingCompletion={isPersistingCompletion}
        listOptions={listOptions}
        membershipRole={membershipRole}
        onClose={closeModal}
        onOpen={openModal}
        onOptimisticBoardChange={onOptimisticBoardChange}
        onOptimisticTitleChange={(nextTitle) => {
          applyPatch({ title: nextTitle });
        }}
        optimisticCard={optimisticCard}
        readOnly={readOnly}
        remainingAssigneeCount={remainingAssigneeCount}
        remoteActiveUsersWithAvatar={remoteActiveUsersWithAvatar}
        remoteDraggingNames={remoteDraggingNames}
        showCardCoverOnFront={showCardCoverOnFront}
        showCompleteStatusOnFront={showCompleteStatusOnFront}
        viewerId={viewerId}
        workspaceLabels={workspaceLabels}
        workspaceMembers={workspaceMembers}
        workspaceSlug={workspaceSlug}
      />
    </Card>
  );
}
