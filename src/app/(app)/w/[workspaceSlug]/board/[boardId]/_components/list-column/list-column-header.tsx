"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";

import { Button } from "@/components/ui";

import { ListHeaderMenu } from "./list-header-menu";
import { ListTitleInlineEditor } from "./list-title-inline-editor";

export function ListColumnHeader({
  attributes,
  boardId,
  listeners,
  laneColorClass,
  listId,
  readOnly,
  subtitle,
  title,
  workspaceSlug,
}: {
  attributes: DraggableAttributes;
  boardId: string;
  listeners: DraggableSyntheticListeners;
  laneColorClass: string;
  listId: string;
  readOnly: boolean;
  subtitle: string | null;
  title: string;
  workspaceSlug: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/12 bg-slate-950/55 px-2.5 py-2">
      <div className="min-w-0">
        <ListTitleInlineEditor
          boardId={boardId}
          laneColorClass={laneColorClass}
          listId={listId}
          readOnly={readOnly}
          title={title}
          workspaceSlug={workspaceSlug}
        />
        {subtitle ? <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-1">
        {!readOnly ? (
          <Button
            {...attributes}
            {...listeners}
            aria-label="Move list"
            className="min-h-8 shrink-0 rounded-md border border-white/15 !bg-slate-900/60 px-2 text-[11px] !text-slate-100 hover:!bg-slate-800/80"
            type="button"
            variant="ghost"
          >
            Move
          </Button>
        ) : null}
        <ListHeaderMenu boardId={boardId} listId={listId} readOnly={readOnly} title={title} workspaceSlug={workspaceSlug} />
      </div>
    </div>
  );
}
