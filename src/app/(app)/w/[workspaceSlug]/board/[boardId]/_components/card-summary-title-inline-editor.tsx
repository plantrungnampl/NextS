"use client";

import { SquarePen } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import { cn } from "@/shared";

import { useRenameCardTitleMutation } from "./board-mutations/hooks";
import { CompletionCircleHint } from "./completion-circle-hint";

function CardTitleEditForm({
  draftTitle,
  formRef,
  inputRef,
  onCancel,
  onDraftChange,
  isSaving,
  onSubmit,
}: {
  draftTitle: string;
  formRef: RefObject<HTMLFormElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  onCancel: () => void;
  onDraftChange: (nextValue: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="min-w-0 flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      ref={formRef}
    >
      <input
        className="min-h-8 w-full rounded-md border border-cyan-300/60 bg-slate-950/80 px-2 text-sm font-semibold leading-snug text-slate-100 outline-none ring-1 ring-cyan-300/60 placeholder:text-slate-500"
        disabled={isSaving}
        maxLength={500}
        minLength={1}
        onBlur={onSubmit}
        onChange={(event) => {
          onDraftChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        ref={inputRef}
        required
        type="text"
        value={draftTitle}
      />
    </form>
  );
}

function CardTitleDisplay({
  canWrite,
  isCompleted,
  onOpen,
  onStartEditing,
  showCompleteStatusOnFront,
  title,
}: {
  canWrite: boolean;
  isCompleted: boolean;
  onOpen: () => void;
  onStartEditing: () => void;
  showCompleteStatusOnFront: boolean;
  title: string;
}) {
  return (
    <button
      className={cn(
        "line-clamp-2 min-w-0 flex-1 text-left text-sm font-semibold leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80",
        isCompleted && showCompleteStatusOnFront ? "text-slate-400 line-through" : "text-slate-100",
        canWrite ? "underline-offset-2 hover:underline" : "",
      )}
      onClick={() => {
        if (!canWrite) {
          onOpen();
          return;
        }
        onStartEditing();
      }}
      type="button"
    >
      {title}
    </button>
  );
}

// eslint-disable-next-line max-lines-per-function
export function CardTitleInlineEditor({
  boardId,
  canWrite,
  cardId,
  isCompleted,
  isPersistingCompletion,
  onOptimisticTitleChange,
  onOpen,
  showCompleteStatusOnFront,
  onToggleComplete,
  title,
  workspaceSlug,
}: {
  boardId: string;
  canWrite: boolean;
  cardId: string;
  isCompleted: boolean;
  isPersistingCompletion: boolean;
  onOptimisticTitleChange?: (nextTitle: string) => void;
  onOpen: () => void;
  showCompleteStatusOnFront: boolean;
  onToggleComplete: (nextIsCompleted: boolean) => void;
  title: string;
  workspaceSlug: string;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const renameCardMutation = useRenameCardTitleMutation({
    boardId,
    cardId,
    onRollbackTitle: () => {
      onOptimisticTitleChange?.(title);
      setDraftTitle(title);
    },
    onSuccessTitle: (nextTitle) => {
      onOptimisticTitleChange?.(nextTitle);
    },
    workspaceSlug,
  });

  useEffect(() => {
    if (!isEditingTitle || !inputRef.current) {
      return;
    }
    inputRef.current.focus();
    inputRef.current.select();
  }, [isEditingTitle]);

  const cancelEditing = () => {
    setDraftTitle(title);
    setIsEditingTitle(false);
  };
  const submitTitleIfChanged = () => {
    const trimmedTitle = draftTitle.trim();
    if (trimmedTitle.length < 1 || trimmedTitle === title) {
      cancelEditing();
      return;
    }
    if (renameCardMutation.isPending) {
      return;
    }

    setIsEditingTitle(false);
    renameCardMutation.mutate({ title: trimmedTitle });
  };
  const circleVisibilityClass = showCompleteStatusOnFront
    ? isCompleted
      ? "opacity-100 pointer-events-auto"
      : "opacity-0 pointer-events-none group-hover/card:opacity-100 group-hover/card:pointer-events-auto group-focus-within/title:opacity-100 group-focus-within/title:pointer-events-auto"
    : "opacity-0 pointer-events-none";

  return (
    <div
      className={cn(
        "group/title mb-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 transition",
        isEditingTitle
          ? "border border-cyan-300/50 bg-cyan-500/10"
          : "border border-transparent group-hover/card:border-white/15 group-hover/card:bg-white/[0.03]",
      )}
    >
      {showCompleteStatusOnFront ? (
        <CompletionCircleHint
          checked={isCompleted}
          className={cn(
            "transition-opacity duration-150",
            circleVisibilityClass,
          )}
          disabled={!canWrite}
          onToggle={() => {
            if (!canWrite) {
              return;
            }
            onToggleComplete(!isCompleted);
          }}
          tooltipSide="bottom"
        />
      ) : null}

      {isEditingTitle ? (
        <CardTitleEditForm
          draftTitle={draftTitle}
          formRef={formRef}
          inputRef={inputRef}
          isSaving={renameCardMutation.isPending}
          onCancel={cancelEditing}
          onDraftChange={setDraftTitle}
          onSubmit={submitTitleIfChanged}
        />
      ) : (
        <CardTitleDisplay
          canWrite={canWrite}
          isCompleted={isCompleted}
          onOpen={onOpen}
          onStartEditing={() => {
            setDraftTitle(title);
            setIsEditingTitle(true);
          }}
          showCompleteStatusOnFront={showCompleteStatusOnFront}
          title={title}
        />
      )}

      {canWrite && !isEditingTitle ? (
        <button
          aria-label="Sửa tiêu đề thẻ"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-0 transition hover:bg-white/10 hover:text-slate-100 group-hover/card:opacity-100 group-focus-within/title:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDraftTitle(title);
            setIsEditingTitle(true);
          }}
          type="button"
        >
          <SquarePen className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
