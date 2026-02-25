import Link from "next/link";

import { Button } from "@/components/ui";
import { APP_ROUTES } from "@/core";
import { requireAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getFirstQueryParamValue } from "@/shared";

import { resolveWorkspaceSearchParams, type WorkspacePageSearchParams, getWorkspaceInvites } from "../page.data";
import { WorkspaceInvitesPanel } from "../_components/workspace-invites-panel";

type WorkspaceSummary = {
  created_at: string;
  id: string;
  name: string;
  slug: string;
};

type WorkspaceMembership = {
  role: "owner" | "admin" | "member";
  workspace_id: string;
};

type WorkspaceInvitesPageProps = {
  searchParams?: WorkspacePageSearchParams | Promise<WorkspacePageSearchParams>;
};

async function getWorkspaceInviteContext(userId: string): Promise<{
  roleByWorkspaceId: Map<string, WorkspaceMembership["role"]>;
  workspaces: WorkspaceSummary[];
}> {
  const supabase = await createServerSupabaseClient();
  const { data: memberships, error: membershipsError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId);

  if (membershipsError) {
    throw new Error(`Failed to load memberships: ${membershipsError.message}`);
  }

  const typedMemberships = (memberships ?? []) as WorkspaceMembership[];
  const roleByWorkspaceId = new Map(
    typedMemberships.map((membership) => [membership.workspace_id, membership.role]),
  );

  const workspaceIds = typedMemberships.map((membership) => membership.workspace_id);
  if (workspaceIds.length === 0) {
    return {
      roleByWorkspaceId,
      workspaces: [],
    };
  }

  const { data: workspaces, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, slug, name, created_at")
    .in("id", workspaceIds)
    .order("created_at", { ascending: false });

  if (workspaceError) {
    throw new Error(`Failed to load workspaces: ${workspaceError.message}`);
  }

  return {
    roleByWorkspaceId,
    workspaces: (workspaces ?? []) as WorkspaceSummary[],
  };
}

export default async function WorkspaceInvitesPage({ searchParams }: WorkspaceInvitesPageProps) {
  const { userId } = await requireAuthContext();
  const supabase = await createServerSupabaseClient();

  const resolvedSearchParams = await resolveWorkspaceSearchParams(searchParams);
  const requestedWorkspaceSlug = getFirstQueryParamValue(resolvedSearchParams.workspace);
  const inviteLink = getFirstQueryParamValue(resolvedSearchParams.inviteLink);
  const inviteMessage = getFirstQueryParamValue(resolvedSearchParams.inviteMessage);
  const inviteMessageType = getFirstQueryParamValue(resolvedSearchParams.inviteType);

  const { roleByWorkspaceId, workspaces } = await getWorkspaceInviteContext(userId);
  const firstWorkspaceSlug = workspaces[0]?.slug;
  const availableWorkspaceSlugs = new Set(workspaces.map((workspace) => workspace.slug));
  const selectedWorkspaceSlug =
    requestedWorkspaceSlug && availableWorkspaceSlugs.has(requestedWorkspaceSlug)
      ? requestedWorkspaceSlug
      : firstWorkspaceSlug;
  const selectedWorkspace = workspaces.find((workspace) => workspace.slug === selectedWorkspaceSlug);
  const selectedWorkspaceRole = selectedWorkspace
    ? roleByWorkspaceId.get(selectedWorkspace.id)
    : undefined;
  const canManageInvites = selectedWorkspaceRole === "owner" || selectedWorkspaceRole === "admin";
  const invites = await getWorkspaceInvites(supabase, selectedWorkspace?.id, canManageInvites);
  const backToWorkspaceHref = selectedWorkspaceSlug
    ? `${APP_ROUTES.workspace.index}?workspace=${encodeURIComponent(selectedWorkspaceSlug)}`
    : APP_ROUTES.workspace.index;

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-[#161a23] p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#1f222d] p-3">
        <div>
          <h1 className="text-base font-semibold text-slate-100">Invite management</h1>
          <p className="text-sm text-slate-400">Invite collaborators and manage pending invitations.</p>
        </div>
        <Link href={backToWorkspaceHref}>
          <Button className="min-h-10" type="button" variant="secondary">
            Back to workspace
          </Button>
        </Link>
      </header>

      {workspaces.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-[#1f222d] p-2">
          {workspaces.map((workspace) => {
            const isActive = workspace.slug === selectedWorkspaceSlug;
            return (
              <Link
                className={
                  isActive
                    ? "rounded-md bg-sky-600/20 px-2.5 py-1.5 text-xs font-semibold text-sky-200"
                    : "rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                }
                href={APP_ROUTES.workspace.invitesBySlug(workspace.slug)}
                key={workspace.id}
              >
                {workspace.name}
              </Link>
            );
          })}
        </div>
      ) : null}

      <WorkspaceInvitesPanel
        canManageInvites={canManageInvites}
        inviteLink={inviteLink}
        inviteMessage={inviteMessage}
        inviteMessageType={inviteMessageType === "error" ? "error" : "success"}
        invites={invites.map((invite) => ({
          acceptedAt: invite.accepted_at,
          createdAt: invite.created_at,
          expiresAt: invite.expires_at,
          id: invite.id,
          invitedEmail: invite.invited_email,
          invitedRole: invite.invited_role,
          status: invite.status,
        }))}
        workspaceName={selectedWorkspace?.name}
        workspaceSlug={selectedWorkspace?.slug}
      />
    </section>
  );
}
