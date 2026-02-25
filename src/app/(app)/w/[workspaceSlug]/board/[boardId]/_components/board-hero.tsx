import Link from "next/link";
import {
  Eye,
  PanelsTopLeft,
} from "lucide-react";

import { APP_ROUTES } from "@/core";
import { cn } from "@/shared";

import type {
  BoardRecord,
  BoardVisibility,
  LabelRecord,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "../types";
import { BoardHeroFavoriteButton } from "./board-hero-favorite-button";
import { BoardHeroFiltersButton } from "./board-hero-filters-button";
import { BoardHeroMoreMenu } from "./board-hero-more-menu";
import { BoardShareDialog } from "./board-share-dialog";
import { BoardHeroVisibilityControls } from "./board-hero-visibility-controls";
import { BoardHeroToolbarIconButton } from "./board-hero-toolbar-icon-button";

export function BoardHero({
  board,
  canWriteBoard,
  role,
  visibility,
  viewerId,
  workspaceName,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: {
  board: BoardRecord;
  canWriteBoard: boolean;
  role: WorkspaceRole;
  visibility: BoardVisibility;
  viewerId: string;
  workspaceName: string;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
}) {
  const isReadOnly = !canWriteBoard;

  return (
    <section className="rounded-2xl border border-white/10 bg-[linear-gradient(98deg,rgba(62,49,99,0.94),rgba(52,43,88,0.93))] px-3 py-2.5 text-white shadow-[0_12px_30px_rgba(8,16,30,0.34)] backdrop-blur-md">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[1.05rem] font-semibold leading-tight">{board.name}</h1>
          <button
            aria-label="Board view options"
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/15 px-2 text-slate-100 transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            type="button"
          >
            <PanelsTopLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-xl border border-white/15 bg-black/15 px-1 py-1">
            <span
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                role === "owner" ? "bg-emerald-500/80 text-white" : "bg-slate-700/80 text-slate-100",
              )}
              title={`Role: ${role}`}
            >
              {role.slice(0, 1).toUpperCase()}
            </span>
            <BoardHeroToolbarIconButton ariaLabel="Automation" iconKey="automation" />
            <BoardHeroToolbarIconButton ariaLabel="Power-ups" iconKey="powerUps" />
            <BoardHeroFiltersButton
              viewerId={viewerId}
              workspaceLabels={workspaceLabels}
              workspaceMembers={workspaceMembers}
            />
            <BoardHeroFavoriteButton
              boardId={board.id}
              initialIsFavorite={board.isFavorite}
              workspaceSlug={workspaceSlug}
            />
            <BoardHeroVisibilityControls
              boardId={board.id}
              canEdit={!isReadOnly}
              initialVisibility={visibility}
              workspaceSlug={workspaceSlug}
            />
            {!isReadOnly ? (
              <BoardShareDialog boardId={board.id} workspaceSlug={workspaceSlug} />
            ) : null}
            <BoardHeroMoreMenu
              boardDescription={board.description}
              boardId={board.id}
              boardName={board.name}
              canWriteBoard={canWriteBoard}
              initialIsFavorite={board.isFavorite}
              initialSettings={{
                commentPermission: board.commentPermission,
                editPermission: board.editPermission,
                memberManagePermission: board.memberManagePermission,
                showCardCoverOnFront: board.showCardCoverOnFront,
                showCompleteStatusOnFront: board.showCompleteStatusOnFront,
              }}
              initialVisibility={visibility}
              role={role}
              workspaceName={workspaceName}
              workspaceSlug={workspaceSlug}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              className="rounded-md border border-white/20 bg-slate-900/55 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-800/75"
              href={APP_ROUTES.workspace.boardsBySlug(workspaceSlug)}
              title="All boards"
            >
              All boards
            </Link>
            {isReadOnly ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-slate-900/70 px-2 py-1 text-[10px] font-medium text-slate-100">
                <Eye className="h-3 w-3" />
                Read-only
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
