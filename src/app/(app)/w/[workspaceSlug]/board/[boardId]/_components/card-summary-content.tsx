"use client";

import Image from "next/image";
import { CalendarClock, CheckSquare, Eye, MessageSquare, Paperclip } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage, Badge } from "@/components/ui";
import { cn } from "@/shared";
import { useNowTickMs } from "@/shared/lib/now-tick";

import {
  CARD_PRIORITY_BADGE_CLASS_BY_VALUE,
  CARD_PRIORITY_ITEMS,
  CARD_PRIORITY_VALUES,
  CARD_STATUS_BADGE_CLASS_BY_VALUE,
  CARD_STATUS_ITEMS,
} from "../card-custom-fields";
import type { CardRecord, LabelRecord } from "../types";
import { CardTitleInlineEditor } from "./card-summary-title-inline-editor";
import {
  formatDueDateLabel,
  getDueDateStatusBadgeClass,
  getDueDateStatusWithContext,
  getInitials,
} from "./card-ui-utils";

type CardSummaryContentProps = {
  attachmentCount: number;
  boardId: string;
  canWrite: boolean;
  card: CardRecord;
  checklistProgress: { completed: number; total: number };
  commentCount: number;
  descriptionPreview: string;
  isPersistingCompletion: boolean;
  onOpen: () => void;
  onOptimisticTitleChange?: (nextTitle: string) => void;
  onToggleComplete: (nextIsCompleted: boolean) => void;
  remainingAssigneeCount: number;
  showCardCoverOnFront: boolean;
  showCompleteStatusOnFront: boolean;
  workspaceSlug: string;
};

const COLLAPSED_LABEL_COUNT = 3;

function CardMediaPreview({
  card,
  showCardCoverOnFront,
}: {
  card: CardRecord;
  showCardCoverOnFront: boolean;
}) {
  if (!showCardCoverOnFront) {
    return null;
  }

  const coverSrc = card.coverAttachmentId ? `/api/attachments/${card.coverAttachmentId}` : null;

  if (!coverSrc) {
    return null;
  }

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-slate-950/80">
      <Image
        alt={`${card.title} cover`}
        className="h-24 w-full object-cover transition-transform duration-300 group-hover/card:scale-105"
        height={96}
        src={coverSrc}
        width={320}
      />
    </div>
  );
}

function CardSummaryLabelBars({
  labels,
}: {
  labels: LabelRecord[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasOverflow = labels.length > COLLAPSED_LABEL_COUNT;
  const shouldShowExpanded = hasOverflow && isExpanded;
  const visibleLabels = hasOverflow && !shouldShowExpanded
    ? labels.slice(0, COLLAPSED_LABEL_COUNT)
    : labels;

  return (
    <div className="mt-1.5 flex items-center gap-1">
      <div className={cn("flex items-center gap-1", isExpanded ? "max-w-full overflow-x-auto pb-0.5 pr-1" : "")}>
        {visibleLabels.map((label) => (
          <span
            className="h-2.5 w-10 shrink-0 rounded-sm border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
            key={label.id}
            style={{ backgroundColor: label.color }}
            title={label.name}
          />
        ))}
      </div>
      {hasOverflow ? (
        <button
          aria-label={isExpanded ? "Collapse labels" : "Show all labels"}
          className="inline-flex h-5 shrink-0 items-center rounded-md border border-white/15 bg-slate-800/70 px-1.5 text-[10px] font-medium text-slate-200 transition-colors hover:border-cyan-300/50 hover:text-cyan-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsExpanded((previous) => !previous);
          }}
          type="button"
        >
          {shouldShowExpanded ? "Thu gọn" : `+${labels.length - COLLAPSED_LABEL_COUNT}`}
        </button>
      ) : null}
    </div>
  );
}

function CardSummaryBody({
  attachmentCount,
  card,
  checklistProgress,
  commentCount,
  descriptionPreview,
  onOpen,
  remainingAssigneeCount,
  showCardCoverOnFront,
}: {
  attachmentCount: number;
  card: CardRecord;
  checklistProgress: { completed: number; total: number };
  commentCount: number;
  descriptionPreview: string;
  onOpen: () => void;
  remainingAssigneeCount: number;
  showCardCoverOnFront: boolean;
}) {
  const nowTickMs = useNowTickMs();
  const displayedAssignees = card.assignees.slice(0, 4);
  const dueDateStatus = getDueDateStatusWithContext(card.due_at, {
    isCompleted: card.is_completed,
    now: new Date(nowTickMs),
  });
  const activeStatusItem = CARD_STATUS_ITEMS.find((item) => item.value === card.status);
  const activePriorityValue = CARD_PRIORITY_VALUES.find((value) => value === card.priority);
  const activePriorityItem = CARD_PRIORITY_ITEMS.find((item) => item.value === activePriorityValue);

  return (
    <div
      className="w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        onOpen();
      }}
      role="button"
      tabIndex={0}
    >
      {card.labels.length > 0 ? <CardSummaryLabelBars labels={card.labels} /> : null}

      {activeStatusItem || activePriorityItem ? (
        <div className={cn("flex flex-wrap items-center gap-1", card.labels.length > 0 ? "mt-1" : "mt-1.5")}>
          {activeStatusItem ? (
            <Badge
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium",
                CARD_STATUS_BADGE_CLASS_BY_VALUE[activeStatusItem.value],
              )}
            >
              {activeStatusItem.label}
            </Badge>
          ) : null}
          {activePriorityItem ? (
            <Badge
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium",
                activePriorityValue ? CARD_PRIORITY_BADGE_CLASS_BY_VALUE[activePriorityValue] : "",
              )}
            >
              {`P: ${activePriorityItem.label}`}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {descriptionPreview.length > 0 ? (
        <p className="mt-1.5 line-clamp-2 text-[12px] text-slate-300">{descriptionPreview}</p>
      ) : null}

      <CardMediaPreview card={card} showCardCoverOnFront={showCardCoverOnFront} />

      <CardSummaryMeta
        attachmentCount={attachmentCount}
        checklistProgress={checklistProgress}
        commentCount={commentCount}
        dueAt={card.due_at}
        dueDateStatus={dueDateStatus}
        watchCount={card.watchCount ?? 0}
      />
      <CardSummaryAssignees
        displayedAssignees={displayedAssignees}
        remainingAssigneeCount={remainingAssigneeCount}
      />
    </div>
  );
}

function CardSummaryMeta({
  attachmentCount,
  checklistProgress,
  commentCount,
  dueAt,
  dueDateStatus,
  watchCount,
}: {
  attachmentCount: number;
  checklistProgress: { completed: number; total: number };
  commentCount: number;
  dueAt: string | null;
  dueDateStatus: ReturnType<typeof getDueDateStatusWithContext>;
  watchCount: number;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
      {dueAt ? (
        <Badge
          className={cn(
            "gap-1 px-2 py-0.5 text-[10px]",
            getDueDateStatusBadgeClass(dueDateStatus),
          )}
          variant="outline"
        >
          <CalendarClock className="h-3 w-3" />
          {formatDueDateLabel(dueAt)}
        </Badge>
      ) : null}
      <Badge className="gap-1 border-slate-600/80 bg-slate-800/70 px-2 py-0.5 text-[10px] text-slate-200">
        <CheckSquare className="h-3 w-3" />
        {checklistProgress.completed}/{checklistProgress.total}
      </Badge>
      {watchCount > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px]">
          <Eye className="h-3.5 w-3.5" />
          {watchCount}
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px]">
        <Paperclip className="h-3.5 w-3.5" />
        {attachmentCount}
      </span>
      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px]">
        <MessageSquare className="h-3.5 w-3.5" />
        {commentCount}
      </span>
    </div>
  );
}

function CardSummaryAssignees({
  displayedAssignees,
  remainingAssigneeCount,
}: {
  displayedAssignees: CardRecord["assignees"];
  remainingAssigneeCount: number;
}) {
  return (
    <div className="mt-2 flex items-center justify-end">
      {displayedAssignees.length > 0 ? (
        <div className="flex items-center -space-x-2">
          {displayedAssignees.map((assignee) => (
            <Avatar
              className="h-6 w-6 border border-slate-950"
              key={assignee.id}
              title={assignee.displayName}
            >
              {assignee.avatarUrl ? <AvatarImage alt={assignee.displayName} src={assignee.avatarUrl} /> : null}
              <AvatarFallback className="bg-slate-800 text-[10px] text-slate-100">{getInitials(assignee.displayName)}</AvatarFallback>
            </Avatar>
          ))}
          {remainingAssigneeCount > 0 ? (
            <Badge className="h-6 min-w-6 justify-center border-slate-900 bg-slate-800 px-1.5 text-[10px] text-slate-200">
              +{remainingAssigneeCount}
            </Badge>
          ) : null}
        </div>
      ) : (
        <span className="text-[10px] text-slate-400">No assignee</span>
      )}
    </div>
  );
}

export function CardSummaryContent({
  attachmentCount,
  boardId,
  canWrite,
  card,
  checklistProgress,
  commentCount,
  descriptionPreview,
  isPersistingCompletion,
  onOpen,
  onOptimisticTitleChange,
  onToggleComplete,
  remainingAssigneeCount,
  showCardCoverOnFront,
  showCompleteStatusOnFront,
  workspaceSlug,
}: CardSummaryContentProps) {
  return (
    <div className="min-w-0 flex-1">
      <CardTitleInlineEditor
        boardId={boardId}
        canWrite={canWrite}
        cardId={card.id}
        isCompleted={card.is_completed}
        isPersistingCompletion={isPersistingCompletion}
        onOpen={onOpen}
        onOptimisticTitleChange={onOptimisticTitleChange}
        showCompleteStatusOnFront={showCompleteStatusOnFront}
        onToggleComplete={onToggleComplete}
        title={card.title}
        workspaceSlug={workspaceSlug}
      />
      <CardSummaryBody
        attachmentCount={attachmentCount}
        card={card}
        checklistProgress={checklistProgress}
        commentCount={commentCount}
        descriptionPreview={descriptionPreview}
        onOpen={onOpen}
        remainingAssigneeCount={remainingAssigneeCount}
        showCardCoverOnFront={showCardCoverOnFront}
      />
    </div>
  );
}
