"use client";

import { MoreHorizontal } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";

import { useArchiveListMutation } from "../board-mutations/hooks";

export function ListHeaderMenu({
  boardId,
  listId,
  readOnly,
  title,
  workspaceSlug,
}: {
  boardId: string;
  listId: string;
  readOnly: boolean;
  title: string;
  workspaceSlug: string;
}) {
  const archiveListMutation = useArchiveListMutation({
    boardId,
    listId,
    workspaceSlug,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Column options"
          className="min-h-8 shrink-0 rounded-md border border-white/15 !bg-slate-900/60 px-2 text-[11px] !text-slate-100 hover:!bg-slate-800/80"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 border border-white/15 bg-slate-900/95 text-slate-100">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuItem className="text-slate-200" disabled>
          Click title to rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!readOnly ? (
          <DropdownMenuItem
            className="text-rose-200 focus:text-rose-100"
            disabled={archiveListMutation.isPending}
            onClick={() => {
              if (archiveListMutation.isPending) {
                return;
              }
              archiveListMutation.mutate();
            }}
          >
            {archiveListMutation.isPending ? "Archiving..." : "Archive list"}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem className="text-slate-400" disabled>
          Drag to reorder lane
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
