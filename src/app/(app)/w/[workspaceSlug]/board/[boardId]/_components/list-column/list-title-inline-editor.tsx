"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared";

import { useRenameListMutation } from "../board-mutations/hooks";

export function ListTitleInlineEditor({
  boardId,
  laneColorClass,
  listId,
  readOnly,
  title,
  workspaceSlug,
}: {
  boardId: string;
  laneColorClass: string;
  listId: string;
  readOnly: boolean;
  title: string;
  workspaceSlug: string;
}) {
  const [draftTitle, setDraftTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const renameMutation = useRenameListMutation({
    boardId,
    listId,
    onRollbackTitle: () => {
      setDraftTitle("");
    },
    onSuccessTitle: (nextTitle) => {
      setDraftTitle(nextTitle);
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
    setDraftTitle("");
    setIsEditingTitle(false);
  };

  const submitTitleIfChanged = () => {
    const trimmedTitle = draftTitle.trim();
    if (trimmedTitle.length < 1 || trimmedTitle === title || renameMutation.isPending) {
      cancelEditing();
      return;
    }

    setIsEditingTitle(false);
    renameMutation.mutate({ title: trimmedTitle });
  };

  if (readOnly) {
    return (
      <p className="truncate text-sm font-semibold text-slate-100">
        <span className={cn("mr-2 inline-flex h-2.5 w-2.5 rounded-full align-middle", laneColorClass)} />
        {title}
      </p>
    );
  }

  if (isEditingTitle) {
    return (
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex h-2.5 w-2.5 shrink-0 rounded-full", laneColorClass)} />
        <div className="min-w-0 flex-1">
          <input
            className="min-h-8 w-full rounded-md border border-cyan-300/70 bg-slate-900/85 px-2 text-sm font-semibold text-slate-100 outline-none ring-1 ring-cyan-300/60 placeholder:text-slate-500"
            data-lane-pan-stop
            disabled={renameMutation.isPending}
            maxLength={200}
            minLength={1}
            onBlur={submitTitleIfChanged}
            onChange={(event) => {
              setDraftTitle(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelEditing();
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                submitTitleIfChanged();
              }
            }}
            ref={inputRef}
            required
            type="text"
            value={draftTitle}
          />
        </div>
      </div>
    );
  }

  return (
    <button
      className="group flex w-full items-center gap-2 truncate text-left text-sm font-semibold text-slate-100"
      data-lane-pan-stop
      onClick={() => {
        setDraftTitle(title);
        setIsEditingTitle(true);
      }}
      type="button"
    >
      <span className={cn("inline-flex h-2.5 w-2.5 shrink-0 rounded-full", laneColorClass)} />
      <span className="truncate underline-offset-2 group-hover:underline">{title}</span>
    </button>
  );
}
