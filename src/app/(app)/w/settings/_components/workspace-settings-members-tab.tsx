import Link from "next/link";

import { Badge, SubmitButton } from "@/components/ui";
import { cn } from "@/shared";

import {
  createWorkspaceInviteFromSettingsAction,
  resendWorkspaceInviteFromSettingsAction,
  revokeWorkspaceInviteFromSettingsAction,
} from "../actions.invites";
import {
  removeWorkspaceMemberAction,
  updateWorkspaceMemberRoleAction,
} from "../actions.members";
import type {
  WorkspaceMemberView,
  WorkspaceSettingsData,
} from "../page.data";

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

type MessageType = "error" | "success";

type WorkspaceSettingsMembersTabProps = {
  canManageMembers: boolean;
  currentUserId: string;
  inviteLink?: string;
  inviteMessage?: string;
  inviteType: MessageType;
  invites: WorkspaceSettingsData["invites"];
  members: WorkspaceMemberView[];
  selectedRole: "admin" | "member" | "owner";
  workspaceSlug: string;
};

function formatDateTime(value: string): string {
  return DATE_FORMATTER.format(new Date(value));
}

function roleTone(role: WorkspaceMemberView["role"]): string {
  if (role === "owner") {
    return "border-amber-600/70 bg-amber-950/40 text-amber-200";
  }

  if (role === "admin") {
    return "border-sky-600/70 bg-sky-950/40 text-sky-200";
  }

  return "border-slate-600/70 bg-slate-900/50 text-slate-200";
}

function InlineMessage({
  message,
  type,
}: {
  message: string;
  type: MessageType;
}) {
  return (
    <p
      className={
        type === "error"
          ? "mt-3 rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200"
          : "mt-3 rounded-md border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200"
      }
    >
      {message}
    </p>
  );
}

function InviteLinkCard({ inviteLink }: { inviteLink: string }) {
  return (
    <div className="mt-3 rounded-lg border border-sky-700/40 bg-sky-950/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">Invite link</p>
      <p className="mt-1 break-all text-xs text-sky-100">{inviteLink}</p>
      <Link className="mt-2 inline-flex text-xs font-medium text-sky-200 hover:text-sky-100" href={inviteLink} rel="noreferrer" target="_blank">
        Mở liên kết mời
      </Link>
    </div>
  );
}

function InviteActions({
  canManageMembers,
  inviteId,
  status,
  workspaceSlug,
}: {
  canManageMembers: boolean;
  inviteId: string;
  status: string;
  workspaceSlug: string;
}) {
  if (!canManageMembers || status !== "pending") {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <form action={resendWorkspaceInviteFromSettingsAction}>
        <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
        <input name="inviteId" type="hidden" value={inviteId} />
        <SubmitButton className="min-h-9 px-3 text-xs" pendingLabel="Đang làm mới...">
          Resend
        </SubmitButton>
      </form>
      <form action={revokeWorkspaceInviteFromSettingsAction}>
        <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
        <input name="inviteId" type="hidden" value={inviteId} />
        <SubmitButton
          className="min-h-9 border border-rose-700 bg-rose-900/30 px-3 text-xs text-rose-200 hover:bg-rose-900/50"
          pendingLabel="Đang thu hồi..."
          variant="secondary"
        >
          Revoke
        </SubmitButton>
      </form>
    </div>
  );
}

function InviteList({
  canManageMembers,
  invites,
  workspaceSlug,
}: {
  canManageMembers: boolean;
  invites: WorkspaceSettingsData["invites"];
  workspaceSlug: string;
}) {
  if (invites.length < 1) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lời mời gần đây</p>
      {invites.map((invite) => (
        <article className="rounded-md border border-slate-700 bg-[#0d1320] p-3" key={invite.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-100">{invite.invited_email}</p>
              <p className="text-xs text-slate-400">
                {invite.invited_role} • {invite.status} • {formatDateTime(invite.created_at)}
              </p>
            </div>
          </div>
          <InviteActions
            canManageMembers={canManageMembers}
            inviteId={invite.id}
            status={invite.status}
            workspaceSlug={workspaceSlug}
          />
        </article>
      ))}
    </div>
  );
}

function InviteSection({
  canManageMembers,
  inviteLink,
  inviteMessage,
  inviteType,
  invites,
  workspaceSlug,
}: {
  canManageMembers: boolean;
  inviteLink?: string;
  inviteMessage?: string;
  inviteType: MessageType;
  invites: WorkspaceSettingsData["invites"];
  workspaceSlug: string;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-[#101623]/80 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Mời thành viên</h2>
      {inviteMessage ? <InlineMessage message={inviteMessage} type={inviteType} /> : null}
      {inviteLink ? <InviteLinkCard inviteLink={inviteLink} /> : null}

      {canManageMembers ? (
        <form action={createWorkspaceInviteFromSettingsAction} className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_160px]">
          <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
          <input
            className="h-10 w-full rounded-md border border-slate-700 bg-[#0e1420] px-3 text-sm text-slate-100 outline-none focus:border-sky-500"
            name="invitedEmail"
            placeholder="member@company.com"
            required
            type="email"
          />
          <select
            className="h-10 w-full rounded-md border border-slate-700 bg-[#0e1420] px-3 text-sm text-slate-100 outline-none focus:border-sky-500"
            defaultValue="member"
            name="invitedRole"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <SubmitButton className="min-h-10" pendingLabel="Đang gửi lời mời...">
            Tạo lời mời
          </SubmitButton>
        </form>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Bạn chỉ có quyền xem danh sách thành viên.</p>
      )}

      <InviteList canManageMembers={canManageMembers} invites={invites} workspaceSlug={workspaceSlug} />
    </article>
  );
}

function MemberRow({
  canManageMembers,
  currentUserId,
  member,
  selectedRole,
  workspaceSlug,
}: {
  canManageMembers: boolean;
  currentUserId: string;
  member: WorkspaceMemberView;
  selectedRole: "admin" | "member" | "owner";
  workspaceSlug: string;
}) {
  const isSelf = member.userId === currentUserId;
  const allowAdminManageTarget = selectedRole === "owner"
    || (selectedRole === "admin" && member.role === "member");
  const canManageRow = canManageMembers && !isSelf && member.role !== "owner" && allowAdminManageTarget;

  return (
    <article className="rounded-md border border-slate-700 bg-[#0d1320] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-100">{member.displayName}</p>
          <p className="text-xs text-slate-400">Joined: {formatDateTime(member.joinedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {isSelf ? <Badge className="border border-slate-600 bg-slate-800/70 text-slate-200" variant="outline">Bạn</Badge> : null}
          <Badge className={cn("border", roleTone(member.role))} variant="outline">
            {member.role}
          </Badge>
        </div>
      </div>

      {canManageRow ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={updateWorkspaceMemberRoleAction} className="flex items-center gap-2">
            <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
            <input name="memberUserId" type="hidden" value={member.userId} />
            <select
              className="h-9 rounded-md border border-slate-700 bg-[#0e1420] px-3 text-xs text-slate-100 outline-none"
              defaultValue={member.role === "admin" ? "admin" : "member"}
              name="nextRole"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <SubmitButton className="min-h-9 px-3 text-xs" pendingLabel="Đang lưu...">
              Cập nhật role
            </SubmitButton>
          </form>

          <form action={removeWorkspaceMemberAction}>
            <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
            <input name="memberUserId" type="hidden" value={member.userId} />
            <SubmitButton
              className="min-h-9 border border-rose-700 bg-rose-900/30 px-3 text-xs text-rose-200 hover:bg-rose-900/50"
              pendingLabel="Đang xóa..."
              variant="secondary"
            >
              Xóa khỏi workspace
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </article>
  );
}

function MembersSection({
  canManageMembers,
  currentUserId,
  members,
  selectedRole,
  workspaceSlug,
}: {
  canManageMembers: boolean;
  currentUserId: string;
  members: WorkspaceMemberView[];
  selectedRole: "admin" | "member" | "owner";
  workspaceSlug: string;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-[#101623]/80 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Danh sách thành viên</h2>
      <div className="mt-3 space-y-2">
        {members.map((member) => (
          <MemberRow
            canManageMembers={canManageMembers}
            currentUserId={currentUserId}
            key={member.userId}
            member={member}
            selectedRole={selectedRole}
            workspaceSlug={workspaceSlug}
          />
        ))}
      </div>
    </article>
  );
}

export function WorkspaceSettingsMembersTab({
  canManageMembers,
  currentUserId,
  inviteLink,
  inviteMessage,
  inviteType,
  invites,
  members,
  selectedRole,
  workspaceSlug,
}: WorkspaceSettingsMembersTabProps) {
  return (
    <div className="space-y-4">
      <InviteSection
        canManageMembers={canManageMembers}
        inviteLink={inviteLink}
        inviteMessage={inviteMessage}
        inviteType={inviteType}
        invites={invites}
        workspaceSlug={workspaceSlug}
      />
      <MembersSection
        canManageMembers={canManageMembers}
        currentUserId={currentUserId}
        members={members}
        selectedRole={selectedRole}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
