import Link from "next/link";

import { APP_ROUTES } from "@/core";
import { requireAuthContext } from "@/lib/auth/server";
import { getFirstQueryParamValue } from "@/shared";

import {
  loadWorkspaceSettingsData,
  resolveMessageType,
  resolveSettingsTabFromParams,
  resolveWorkspaceSettingsSearchParams,
  type WorkspaceSettingsSearchParams,
} from "./page.data";
import { WorkspaceDangerZone } from "./_components/workspace-danger-zone";
import { WorkspaceSettingsGeneralTab } from "./_components/workspace-settings-general-tab";
import { WorkspaceSettingsHeader } from "./_components/workspace-settings-header";
import { WorkspaceSettingsMembersTab } from "./_components/workspace-settings-members-tab";
import { WorkspaceSidebar } from "../_components/workspace-sidebar";

type WorkspaceSettingsPageProps = {
  searchParams?: WorkspaceSettingsSearchParams | Promise<WorkspaceSettingsSearchParams>;
};

function StatusMessage({
  message,
  type,
}: {
  message: string;
  type: "error" | "success";
}) {
  return (
    <p
      className={
        type === "error"
          ? "rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200"
          : "rounded-md border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200"
      }
    >
      {message}
    </p>
  );
}

function EmptySettingsState() {
  return (
    <section className="rounded-xl border border-slate-800 bg-[#161a23] p-5 text-sm text-slate-300">
      <h1 className="text-lg font-semibold text-slate-100">Cài đặt Workspace</h1>
      <p className="mt-2">Bạn chưa có workspace khả dụng để cấu hình.</p>
      <Link className="mt-4 inline-flex text-sky-300 hover:text-sky-200" href={APP_ROUTES.workspace.index}>
        Quay về trang workspace
      </Link>
    </section>
  );
}

export default async function WorkspaceSettingsPage({ searchParams }: WorkspaceSettingsPageProps) {
  const { userId } = await requireAuthContext();
  const resolvedSearchParams = await resolveWorkspaceSettingsSearchParams(searchParams);
  const requestedWorkspaceSlug = getFirstQueryParamValue(resolvedSearchParams.workspace);
  const activeTab = resolveSettingsTabFromParams(resolvedSearchParams);

  const data = await loadWorkspaceSettingsData({
    requestedWorkspaceSlug,
    userId,
  });

  const statusMessage = getFirstQueryParamValue(resolvedSearchParams.message);
  const statusType = resolveMessageType(getFirstQueryParamValue(resolvedSearchParams.type));
  const inviteMessage = getFirstQueryParamValue(resolvedSearchParams.inviteMessage);
  const inviteType = resolveMessageType(getFirstQueryParamValue(resolvedSearchParams.inviteType));
  const inviteLink = getFirstQueryParamValue(resolvedSearchParams.inviteLink);

  if (!data.selectedWorkspace || !data.selectedRole) {
    return <EmptySettingsState />;
  }

  const selectedWorkspace = data.selectedWorkspace;
  const canManageCore = data.selectedRole === "owner" || data.selectedRole === "admin";
  const canManageMembers = canManageCore;
  const canManageDanger = data.selectedRole === "owner";

  return (
    <div className="grid gap-4 lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
      <WorkspaceSidebar
        activeWorkspaceSlug={selectedWorkspace.slug}
        statusMessage={undefined}
        workspaces={data.workspaces.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        }))}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_top,_#1f2c45_0%,_#0f1420_42%,_#090d15_100%)]">
        <WorkspaceSettingsHeader
          activeTab={activeTab}
          selectedRole={data.selectedRole}
          selectedWorkspace={selectedWorkspace}
          workspaces={data.workspaces}
        />

        <div className="space-y-4 px-5 py-5 sm:px-6">
          {statusMessage ? <StatusMessage message={statusMessage} type={statusType} /> : null}

          {activeTab === "general" ? (
            <WorkspaceSettingsGeneralTab canManageCore={canManageCore} workspace={selectedWorkspace} />
          ) : null}

          {activeTab === "members" ? (
            <WorkspaceSettingsMembersTab
              canManageMembers={canManageMembers}
              currentUserId={data.currentUserId}
              inviteLink={inviteLink}
              inviteMessage={inviteMessage}
              inviteType={inviteType}
              invites={data.invites}
              members={data.members}
              selectedRole={data.selectedRole}
              workspaceSlug={selectedWorkspace.slug}
            />
          ) : null}

          {activeTab === "danger" ? (
            <WorkspaceDangerZone
              canLeaveWorkspace={data.canLeaveWorkspace}
              canManageDanger={canManageDanger}
              transferCandidates={data.transferCandidates}
              workspaceSlug={selectedWorkspace.slug}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
