"use client";

import { Check, ChevronLeft, Loader2, Search, X } from "lucide-react";
import { useMemo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui";

import type { WorkspaceMemberRecord } from "../types";
import { getInitials } from "./card-ui-utils";

type MembersPanelProps = {
  canWrite: boolean;
  getIsAssigned: (memberId: string) => boolean;
  members: WorkspaceMemberRecord[];
  onBack: () => void;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onToggleMember: (memberId: string) => void;
  pendingMemberIds: Record<string, boolean>;
  query: string;
};

export function MembersPanel({
  canWrite,
  getIsAssigned,
  members,
  onBack,
  onClose,
  onQueryChange,
  onToggleMember,
  pendingMemberIds,
  query,
}: MembersPanelProps) {
  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 1) {
      return members;
    }

    return members.filter((member) => member.displayName.toLowerCase().includes(normalizedQuery));
  }, [members, query]);

  return (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button
          aria-label="Quay lại menu thêm"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-base font-semibold">Thành viên</p>
        <button
          aria-label="Đóng menu thành viên"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-9 w-full rounded-md border border-slate-600 bg-[#2a2d33] pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-[#8eb7ff]"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm kiếm các thành viên"
            value={query}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-300">Thành viên của bảng</p>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const isAssigned = getIsAssigned(member.id);
                const isPending = Boolean(pendingMemberIds[member.id]);
                return (
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canWrite || isPending}
                    key={member.id}
                    onClick={() => onToggleMember(member.id)}
                    type="button"
                  >
                    <Avatar className="h-7 w-7 border border-slate-700">
                      {member.avatarUrl ? <AvatarImage alt={member.displayName} src={member.avatarUrl} /> : null}
                      <AvatarFallback className="bg-slate-700 text-[10px] text-slate-100">
                        {getInitials(member.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-100">
                      {member.displayName}
                    </span>
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                    ) : isAssigned ? (
                      <Check className="h-4 w-4 text-emerald-300" />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="rounded-md border border-slate-600 bg-[#2a2d33] px-3 py-2 text-xs text-slate-300">
                Không tìm thấy thành viên phù hợp.
              </p>
            )}
          </div>
        </div>
        {!canWrite ? (
          <p className="text-[11px] text-slate-400">Read-only mode: member updates are disabled.</p>
        ) : null}
      </div>
    </>
  );
}
