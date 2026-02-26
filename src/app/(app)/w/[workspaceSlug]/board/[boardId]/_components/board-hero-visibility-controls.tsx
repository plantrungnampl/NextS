"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe2, Lock, Users, type LucideIcon } from "lucide-react";

import { cn } from "@/shared";

import type { BoardVisibility } from "../types";
import { BoardHeroVisibilityButton } from "./board-hero-visibility-button";
import {
  buildBoardVisibilityQueryKey,
  type BoardVisibilityClientState,
} from "./board-visibility-query";

const visibilityMeta: Record<BoardVisibilityClientState, { Icon: LucideIcon; label: string }> = {
  private: { Icon: Lock, label: "Riêng tư" },
  public: { Icon: Globe2, label: "Công khai" },
  workspace: { Icon: Users, label: "Không gian làm việc" },
};

export function BoardHeroVisibilityControls({
  boardId,
  canManage,
  initialVisibility,
  workspaceSlug,
}: {
  boardId: string;
  canManage: boolean;
  initialVisibility: BoardVisibility;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = buildBoardVisibilityQueryKey({ boardId, workspaceSlug });
  const visibilityQuery = useQuery({
    initialData: initialVisibility,
    queryFn: () => {
      const cachedVisibility = queryClient.getQueryData<BoardVisibilityClientState>(queryKey);
      return cachedVisibility ?? initialVisibility;
    },
    queryKey,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const visibility = visibilityQuery.data;
  const { Icon, label } = visibilityMeta[visibility];

  return (
    <div className="inline-flex items-center gap-1.5">
      <BoardHeroVisibilityButton
        boardId={boardId}
        canManage={canManage}
        visibility={visibility}
        workspaceSlug={workspaceSlug}
      />
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-200",
          canManage ? "" : "opacity-90",
        )}
        title={`Visibility: ${label}`}
      >
        <Icon className="h-3 w-3" />
        {label}
      </span>
    </div>
  );
}
