"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2, Mail, RefreshCw, UserMinus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from "@/components/ui";

import {
  createBoardInviteInline,
  getBoardShareSnapshotInline,
  removeBoardMemberInline,
  resendBoardInviteInline,
  revokeBoardInviteInline,
  type BoardShareRole,
  updateBoardMemberRoleInline,
} from "../actions.board-share";

const INVITE_ROLE_OPTIONS: BoardShareRole[] = [
  "member",
  "viewer",
  "admin",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) {
    return "??";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

async function copyToClipboard(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error("Không thể sao chép nội dung.");
  }
}

function roleLabel(role: BoardShareRole): string {
  if (role === "admin") {
    return "Quản trị viên";
  }

  if (role === "viewer") {
    return "Người xem";
  }

  return "Thành viên";
}

// eslint-disable-next-line max-lines-per-function
export function BoardShareDialog({
  boardId,
  hideTrigger = false,
  onOpenChange,
  open,
  workspaceSlug,
}: {
  boardId: string;
  hideTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "invites">("members");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [invitedRole, setInvitedRole] = useState<BoardShareRole>("member");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  const setResolvedOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const queryKey = useMemo(
    () => ["board-share", workspaceSlug, boardId] as const,
    [boardId, workspaceSlug],
  );

  const shareQuery = useQuery({
    enabled: resolvedOpen,
    queryFn: async () => {
      const snapshot = await getBoardShareSnapshotInline({
        boardId,
        workspaceSlug,
      });

      if (!snapshot) {
        throw new Error("Không thể tải dữ liệu chia sẻ bảng.");
      }

      return snapshot;
    },
    queryKey,
    staleTime: 10_000,
  });

  const createInviteMutation = useMutation({
    mutationFn: async () =>
      createBoardInviteInline({
        boardId,
        invitedEmail,
        invitedRole,
        workspaceSlug,
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể tạo lời mời.");
        return;
      }

      setInvitedEmail("");
      setLastInviteLink(result.inviteLink ?? null);
      toast.success("Đã tạo lời mời tham gia bảng.");
      await queryClient.invalidateQueries({ queryKey });
      setActiveTab("invites");
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (inviteId: string) =>
      resendBoardInviteInline({
        boardId,
        inviteId,
        workspaceSlug,
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể gửi lại lời mời.");
        return;
      }

      setLastInviteLink(result.inviteLink ?? null);
      toast.success("Đã gửi lại lời mời.");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) =>
      revokeBoardInviteInline({
        boardId,
        inviteId,
        workspaceSlug,
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể thu hồi lời mời.");
        return;
      }

      toast.success("Đã thu hồi lời mời.");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (input: { nextRole: BoardShareRole; userId: string }) =>
      updateBoardMemberRoleInline({
        boardId,
        nextRole: input.nextRole,
        userId: input.userId,
        workspaceSlug,
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể cập nhật vai trò.");
        return;
      }

      toast.success("Đã cập nhật vai trò thành viên.");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) =>
      removeBoardMemberInline({
        boardId,
        userId,
        workspaceSlug,
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể xóa thành viên.");
        return;
      }

      toast.success("Đã xóa thành viên khỏi bảng.");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const shareData = shareQuery.data;
  const canManage = shareData?.canManage ?? false;

  return (
    <>
      {!hideTrigger ? (
        <button
          className="inline-flex min-h-8 items-center rounded-md bg-white/85 px-3 text-sm font-semibold text-[#172b4d] transition-colors hover:bg-white"
          onClick={() => {
            setResolvedOpen(true);
          }}
          type="button"
        >
          Chia sẻ
        </button>
      ) : null}

      <Dialog onOpenChange={setResolvedOpen} open={resolvedOpen}>
        <DialogContent className="w-[min(94vw,640px)] border border-[#4a5160] bg-[#2f343d] p-0 text-slate-100">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-100">Chia sẻ bảng</DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                Mời thành viên và quản lý quyền truy cập theo bảng.
              </DialogDescription>
            </div>
            <button
              aria-label="Đóng"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
              onClick={() => {
                setResolvedOpen(false);
              }}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 px-4 pb-4 pt-3">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_110px]">
              <Input
                className="h-10 border-slate-500/70 bg-[#252a33] text-slate-100 placeholder:text-slate-400"
                onChange={(event) => {
                  setInvitedEmail(event.currentTarget.value);
                }}
                placeholder="Địa chỉ email hoặc tên"
                value={invitedEmail}
              />
              <select
                className="h-10 rounded-md border border-slate-500/70 bg-[#252a33] px-3 text-sm text-slate-100 outline-none focus:border-sky-400"
                onChange={(event) => {
                  const nextRole = event.currentTarget.value as BoardShareRole;
                  setInvitedRole(nextRole);
                }}
                value={invitedRole}
              >
                {INVITE_ROLE_OPTIONS.map((roleOption) => (
                  <option key={roleOption} value={roleOption}>
                    {roleLabel(roleOption)}
                  </option>
                ))}
              </select>
              <button
                className="h-10 rounded-md bg-sky-500 px-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canManage || invitedEmail.trim().length === 0 || createInviteMutation.isPending}
                onClick={() => {
                  createInviteMutation.mutate();
                }}
                type="button"
              >
                {createInviteMutation.isPending ? "Đang mời..." : "Chia sẻ"}
              </button>
            </div>

            <div className="rounded-md border border-white/10 bg-[#252a33] px-3 py-2">
              <p className="text-xs font-semibold text-slate-200">Chia sẻ bảng này bằng liên kết</p>
              <div className="mt-1 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-slate-400" />
                <span className="truncate text-sm text-slate-300">{shareData?.boardLink ?? "..."}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <button
                  className="inline-flex items-center gap-1 text-sky-300 transition hover:text-sky-200"
                  disabled={!shareData?.boardLink}
                  onClick={() => {
                    if (!shareData?.boardLink) {
                      return;
                    }

                    void copyToClipboard(shareData.boardLink, "Đã sao chép liên kết bảng.");
                  }}
                  type="button"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Sao chép liên kết bảng
                </button>
                {lastInviteLink ? (
                  <button
                    className="inline-flex items-center gap-1 text-sky-300 transition hover:text-sky-200"
                    onClick={() => {
                      void copyToClipboard(lastInviteLink, "Đã sao chép liên kết mời.");
                    }}
                    type="button"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Sao chép liên kết mời mới nhất
                  </button>
                ) : null}
                {lastInviteLink ? (
                  <a
                    className="inline-flex items-center gap-1 text-sky-300 transition hover:text-sky-200"
                    href={lastInviteLink}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Mở link mời
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3 border-b border-white/10 text-sm">
              <button
                className={`pb-2 font-semibold transition ${activeTab === "members" ? "border-b-2 border-sky-400 text-sky-300" : "text-slate-300 hover:text-slate-100"}`}
                onClick={() => {
                  setActiveTab("members");
                }}
                type="button"
              >
                Thành viên của bảng thông tin {shareData?.members.length ?? 0}
              </button>
              <button
                className={`pb-2 font-semibold transition ${activeTab === "invites" ? "border-b-2 border-sky-400 text-sky-300" : "text-slate-300 hover:text-slate-100"}`}
                onClick={() => {
                  setActiveTab("invites");
                }}
                type="button"
              >
                Yêu cầu tham gia
              </button>
            </div>

            {shareQuery.isLoading ? (
              <p className="rounded-md border border-white/10 bg-[#252a33] px-3 py-2 text-sm text-slate-300">
                Đang tải thông tin chia sẻ...
              </p>
            ) : null}

            {shareQuery.isError ? (
              <p className="rounded-md border border-rose-500/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                Không thể tải dữ liệu chia sẻ bảng.
              </p>
            ) : null}

            {activeTab === "members" ? (
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {(shareData?.members ?? []).map((member) => (
                  <article
                    className="flex items-center justify-between rounded-md border border-white/10 bg-[#252a33] px-3 py-2"
                    key={member.id}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {member.avatarUrl ? <AvatarImage alt={member.displayName} src={member.avatarUrl} /> : null}
                        <AvatarFallback>{getInitials(member.displayName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">{member.displayName}</p>
                        <p className="text-xs text-slate-400">{roleLabel(member.role)}</p>
                      </div>
                    </div>

                    {canManage ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="h-8 rounded-md border border-slate-500/70 bg-[#1f2430] px-2 text-xs text-slate-100 outline-none focus:border-sky-400"
                          disabled={updateRoleMutation.isPending}
                          onChange={(event) => {
                            const nextRole = event.currentTarget.value as BoardShareRole;
                            if (nextRole === member.role) {
                              return;
                            }

                            updateRoleMutation.mutate({
                              nextRole,
                              userId: member.id,
                            });
                          }}
                          value={member.role}
                        >
                          {INVITE_ROLE_OPTIONS.map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {roleLabel(roleOption)}
                            </option>
                          ))}
                        </select>
                        <button
                          aria-label="Xóa thành viên"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={removeMemberMutation.isPending}
                          onClick={() => {
                            removeMemberMutation.mutate(member.id);
                          }}
                          type="button"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {shareData && shareData.members.length === 0 ? (
                  <p className="rounded-md border border-white/10 bg-[#252a33] px-3 py-2 text-sm text-slate-300">
                    Chưa có thành viên nào trong bảng này.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {(shareData?.pendingInvites ?? []).map((invite) => (
                  <article
                    className="rounded-md border border-white/10 bg-[#252a33] px-3 py-2"
                    key={invite.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">{invite.invitedEmail}</p>
                        <p className="text-xs text-slate-400">
                          Vai trò: {roleLabel(invite.invitedRole)}
                        </p>
                      </div>
                      {canManage ? (
                        <div className="flex items-center gap-1">
                          <button
                            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-sky-300 transition hover:bg-sky-500/15 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={resendInviteMutation.isPending}
                            onClick={() => {
                              resendInviteMutation.mutate(invite.id);
                            }}
                            type="button"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Gửi lại
                          </button>
                          <button
                            className="inline-flex h-8 items-center rounded-md px-2 text-xs text-rose-300 transition hover:bg-rose-500/15 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={revokeInviteMutation.isPending}
                            onClick={() => {
                              revokeInviteMutation.mutate(invite.id);
                            }}
                            type="button"
                          >
                            Thu hồi
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Hết hạn: {new Date(invite.expiresAt).toLocaleString()}</p>
                  </article>
                ))}
                {shareData && shareData.pendingInvites.length === 0 ? (
                  <p className="rounded-md border border-white/10 bg-[#252a33] px-3 py-2 text-sm text-slate-300">
                    Không có yêu cầu tham gia đang chờ.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
