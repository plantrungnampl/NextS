"use client";

import { useEffect, useRef, useState } from "react";

import type { CardRecord } from "../types";
import { useRenameCardTitleMutation } from "./board-mutations/hooks";
import { CompletionCircleHint } from "./completion-circle-hint";

// eslint-disable-next-line max-lines-per-function
function ModalTitleInlineEditor({
  boardId,
  canWrite,
  cardId,
  isCompleted,
  onOptimisticTitleChange,
  title,
  workspaceSlug,
}: {
  boardId: string;
  canWrite: boolean;
  cardId: string;
  isCompleted: boolean;
  onOptimisticTitleChange?: (nextTitle: string) => void;
  title: string;
  workspaceSlug: string;
}) {
  const [draftTitle, setDraftTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const renameCardMutation = useRenameCardTitleMutation({
    boardId,
    cardId,
    onRollbackTitle: () => {
      onOptimisticTitleChange?.(title);
      setDraftTitle("");
    },
    onSuccessTitle: (nextTitle) => {
      onOptimisticTitleChange?.(nextTitle);
    },
    workspaceSlug,
  });

  const reset = () => {
    setDraftTitle("");
    setIsEditingTitle(false);
  };

  useEffect(() => {
    if (!isEditingTitle || !inputRef.current) {
      return;
    }

    inputRef.current.focus();
    inputRef.current.select();
  }, [isEditingTitle]);

  if (!canWrite) {
    return (
      <h2
        className={
          isCompleted
            ? "break-words text-[44px] font-semibold leading-none text-slate-400 line-through"
            : "break-words text-[44px] font-semibold leading-none text-slate-100"
        }
      >
        {title}
      </h2>
    );
  }

  if (isEditingTitle) {
    return (
      <div className="w-full">
        <input
          className="h-14 w-full rounded-md border border-slate-500 bg-[#2f3035] px-3 text-[42px] font-semibold leading-none text-slate-100 outline-none"
          disabled={renameCardMutation.isPending}
          maxLength={500}
          minLength={1}
          onBlur={() => {
            const trimmed = draftTitle.trim();
            if (trimmed.length < 1 || trimmed === title || renameCardMutation.isPending) {
              reset();
              return;
            }

            onOptimisticTitleChange?.(trimmed);
            setIsEditingTitle(false);
            renameCardMutation.mutate({ title: trimmed });
          }}
          onChange={(event) => {
            setDraftTitle(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              reset();
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              const trimmed = draftTitle.trim();
              if (trimmed.length < 1 || trimmed === title) {
                reset();
                return;
              }
              if (renameCardMutation.isPending) {
                return;
              }

              onOptimisticTitleChange?.(trimmed);
              setIsEditingTitle(false);
              renameCardMutation.mutate({ title: trimmed });
            }
          }}
          required
          ref={inputRef}
          type="text"
          value={draftTitle}
        />
      </div>
    );
  }

  return (
    <button
      className={
        isCompleted
          ? "break-words text-left text-[44px] font-semibold leading-none text-slate-400 line-through"
          : "break-words text-left text-[44px] font-semibold leading-none text-slate-100"
      }
      onClick={() => {
        setDraftTitle(title);
        setIsEditingTitle(true);
      }}
      type="button"
    >
      {title}
    </button>
  );
}

export function CardTitleRow({
  boardId,
  canWrite,
  card,
  onOptimisticTitleChange,
  onToggleComplete,
  workspaceSlug,
}: {
  boardId: string;
  canWrite: boolean;
  card: CardRecord;
  onOptimisticTitleChange?: (nextTitle: string) => void;
  onToggleComplete?: (nextIsCompleted: boolean) => void;
  workspaceSlug: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <CompletionCircleHint
        checked={card.is_completed}
        className="mt-2"
        disabled={!canWrite}
        onToggle={() => {
          if (!canWrite) {
            return;
          }
          onToggleComplete?.(!card.is_completed);
        }}
        tooltipSide="bottom"
      />
      <ModalTitleInlineEditor
        boardId={boardId}
        canWrite={canWrite}
        cardId={card.id}
        isCompleted={card.is_completed}
        onOptimisticTitleChange={onOptimisticTitleChange}
        title={card.title}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
