import Link from "next/link";

import { Input, Label, SubmitButton } from "@/components/ui";

import {
  createWorkspaceInvite,
  resendWorkspaceInvite,
  revokeWorkspaceInvite,
} from "../invites/actions";

type WorkspaceInvite = {
  acceptedAt: string | null;
  createdAt: string;
  expiresAt: string;
  id: string;
  invitedEmail: string;
  invitedRole: "owner" | "admin" | "member";
  status: "pending" | "accepted" | "revoked" | "expired";
};

type WorkspaceInvitesPanelProps = {
  canManageInvites: boolean;
  inviteLink?: string;
  inviteMessage?: string;
  inviteMessageType?: "error" | "success";
  invites: WorkspaceInvite[];
  workspaceName?: string;
  workspaceSlug?: string;
};

type EffectiveInviteStatus = "pending" | "accepted" | "revoked" | "expired";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string): string {
  return DATE_FORMATTER.format(new Date(value));
}

function getEffectiveInviteStatus(invite: WorkspaceInvite): EffectiveInviteStatus {
  if (invite.status !== "pending") {
    return invite.status;
  }

  return new Date(invite.expiresAt).getTime() <= Date.now() ? "expired" : "pending";
}

function statusBadgeClass(status: EffectiveInviteStatus): string {
  if (status === "accepted") {
    return "border-emerald-700/60 bg-emerald-900/40 text-emerald-200";
  }

  if (status === "revoked") {
    return "border-rose-700/60 bg-rose-900/40 text-rose-200";
  }

  if (status === "expired") {
    return "border-amber-700/60 bg-amber-900/40 text-amber-200";
  }

  return "border-sky-700/60 bg-sky-900/40 text-sky-200";
}

function statusLabel(status: EffectiveInviteStatus): string {
  if (status === "accepted") {
    return "Accepted";
  }

  if (status === "revoked") {
    return "Revoked";
  }

  if (status === "expired") {
    return "Expired";
  }

  return "Pending";
}

function InviteCreateForm({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <form action={createWorkspaceInvite} className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_140px]">
      <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
      <div className="space-y-1">
        <Label className="text-xs text-slate-300" htmlFor="invite-email">
          Email
        </Label>
        <Input
          className="min-h-10 border-slate-700 bg-[#161a22] text-slate-100 placeholder:text-slate-500"
          id="invite-email"
          name="invitedEmail"
          placeholder="member@company.com"
          required
          type="email"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-slate-300" htmlFor="invite-role">
          Role
        </Label>
        <select
          className="h-10 w-full rounded-md border border-slate-700 bg-[#161a22] px-3 text-sm text-slate-100 outline-none focus:border-sky-500"
          defaultValue="member"
          id="invite-role"
          name="invitedRole"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-slate-300">&nbsp;</Label>
        <SubmitButton className="min-h-10 w-full" pendingLabel="Creating invite...">
          Create invite
        </SubmitButton>
      </div>
    </form>
  );
}

function InviteMessage({
  inviteMessage,
  inviteMessageType,
}: {
  inviteMessage?: string;
  inviteMessageType: "error" | "success";
}) {
  if (!inviteMessage) {
    return null;
  }

  return (
    <p
      className={
        inviteMessageType === "error"
          ? "mt-3 rounded-md border border-rose-700/50 bg-rose-900/30 px-3 py-2 text-xs text-rose-200"
          : "mt-3 rounded-md border border-emerald-700/50 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-200"
      }
    >
      {inviteMessage}
    </p>
  );
}

function InviteLinkPanel({ inviteLink }: { inviteLink?: string }) {
  if (!inviteLink) {
    return null;
  }

  return (
    <div className="mt-3 space-y-1 rounded-md border border-sky-700/50 bg-sky-950/30 p-2.5">
      <p className="text-xs font-semibold text-sky-200">Invite link</p>
      <Input
        className="min-h-10 border-sky-700 bg-sky-950/40 text-sky-100"
        readOnly
        value={inviteLink}
      />
      <Link
        className="text-xs font-medium text-sky-300 underline-offset-2 hover:underline"
        href={inviteLink}
        rel="noreferrer"
        target="_blank"
      >
        Open invite link
      </Link>
    </div>
  );
}

function InviteActions({
  inviteId,
  workspaceSlug,
}: {
  inviteId: string;
  workspaceSlug: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <form action={resendWorkspaceInvite}>
        <input name="inviteId" type="hidden" value={inviteId} />
        <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
        <SubmitButton className="min-h-9 px-3 text-xs" pendingLabel="Resending...">
          Resend
        </SubmitButton>
      </form>
      <form action={revokeWorkspaceInvite}>
        <input name="inviteId" type="hidden" value={inviteId} />
        <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
        <SubmitButton
          className="min-h-9 border border-rose-700 bg-rose-900/30 px-3 text-xs text-rose-200 hover:bg-rose-900/50"
          pendingLabel="Revoking..."
          type="submit"
          variant="secondary"
        >
          Revoke
        </SubmitButton>
      </form>
    </div>
  );
}

function InviteList({
  invites,
  workspaceSlug,
}: {
  invites: WorkspaceInvite[];
  workspaceSlug: string;
}) {
  if (invites.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-700 bg-[#171a22] px-3 py-2 text-sm text-slate-400">
        No invites yet for this workspace.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {invites.map((invite) => {
        const effectiveStatus = getEffectiveInviteStatus(invite);
        const canManagePending = invite.status === "pending";

        return (
          <article className="rounded-md border border-slate-700 bg-[#171a22] p-2.5" key={invite.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-100">{invite.invitedEmail}</p>
                <p className="text-xs text-slate-400">
                  Role: {invite.invitedRole} • Created: {formatDateTime(invite.createdAt)}
                </p>
                <p className="text-xs text-slate-400">
                  Expires: {formatDateTime(invite.expiresAt)}
                  {invite.acceptedAt ? ` • Accepted: ${formatDateTime(invite.acceptedAt)}` : ""}
                </p>
              </div>
              <span
                className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(effectiveStatus)}`}
              >
                {statusLabel(effectiveStatus)}
              </span>
            </div>

            {canManagePending ? <InviteActions inviteId={invite.id} workspaceSlug={workspaceSlug} /> : null}
          </article>
        );
      })}
    </div>
  );
}

function InvitePanelUnavailable({
  message,
  workspaceName,
}: {
  message: string;
  workspaceName?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-[#1f222d] p-4">
      <h2 className="text-base font-semibold text-slate-100">Invite members</h2>
      {workspaceName ? (
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{workspaceName}</p>
      ) : null}
      <p className="mt-2 text-sm text-slate-400">{message}</p>
    </section>
  );
}

export function WorkspaceInvitesPanel({
  canManageInvites,
  inviteLink,
  inviteMessage,
  inviteMessageType = "success",
  invites,
  workspaceName,
  workspaceSlug,
}: WorkspaceInvitesPanelProps) {
  if (!workspaceSlug || !workspaceName) {
    return <InvitePanelUnavailable message="Create a workspace first to invite collaborators." />;
  }

  if (!canManageInvites) {
    return (
      <InvitePanelUnavailable
        message="Only workspace owner/admin can create or manage invites."
        workspaceName={workspaceName}
      />
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-[#1f222d] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-100">Invite members</h2>
        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{workspaceName}</span>
      </div>

      <InviteCreateForm workspaceSlug={workspaceSlug} />
      <InviteMessage inviteMessage={inviteMessage} inviteMessageType={inviteMessageType} />
      <InviteLinkPanel inviteLink={inviteLink} />

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent invites</p>
        <InviteList invites={invites} workspaceSlug={workspaceSlug} />
      </div>
    </section>
  );
}
