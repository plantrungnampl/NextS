"use client";

import { useMemo, useState } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";

import type { BoardViewer, WorkspaceMemberRecord, WorkspaceRole } from "../types";

function getInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter((value) => value.length > 0);
  if (words.length === 0) {
    return "?";
  }

  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
  return initials.length > 0 ? initials : "?";
}

function getRoleLabel(role: WorkspaceRole): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "member") return "Member";
  return "Viewer";
}

function getRoleBadgeClassName(role: WorkspaceRole): string {
  if (role === "owner") return "border-emerald-300/50 bg-emerald-500/20 text-emerald-100";
  if (role === "admin") return "border-cyan-300/50 bg-cyan-500/20 text-cyan-100";
  if (role === "member") return "border-slate-300/40 bg-slate-500/25 text-slate-100";
  return "border-amber-300/40 bg-amber-500/20 text-amber-100";
}

export function BoardHeroViewerPopover({
  role,
  viewer,
  workspaceMembers,
}: {
  role: WorkspaceRole;
  viewer: BoardViewer;
  workspaceMembers: WorkspaceMemberRecord[];
}) {
  const [open, setOpen] = useState(false);

  const avatarUrl = useMemo(
    () => workspaceMembers.find((member) => member.id === viewer.id)?.avatarUrl ?? null,
    [viewer.id, workspaceMembers],
  );

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Thông tin tài khoản"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 p-0 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          type="button"
        >
          <Avatar className="h-8 w-8">
            {avatarUrl ? <AvatarImage alt={viewer.displayName} src={avatarUrl} /> : null}
            <AvatarFallback className="bg-emerald-500/80 text-[11px] font-bold text-white">
              {getInitials(viewer.displayName)}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] border-[#4a5160] bg-[#2f343d] p-0 text-slate-100">
        <div className="space-y-3 px-3 py-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9 border border-white/10">
              {avatarUrl ? <AvatarImage alt={viewer.displayName} src={avatarUrl} /> : null}
              <AvatarFallback className="bg-emerald-500/80 text-xs font-bold text-white">
                {getInitials(viewer.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{viewer.displayName}</p>
              <p className="truncate text-xs text-slate-300">{viewer.email || "Chưa có email"}</p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-2">
            <Badge className={`border ${getRoleBadgeClassName(role)} px-2 py-0.5 text-[10px] font-semibold`}>
              {getRoleLabel(role)}
            </Badge>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
