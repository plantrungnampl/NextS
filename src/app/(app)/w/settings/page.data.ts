import { createServerSupabaseClient } from "@/lib/supabase";
import { getFirstQueryParamValue, isPromise } from "@/shared";

import { getWorkspaceInvites, type WorkspaceInviteSummary } from "../page.data";

export type WorkspaceSettingsTab = "billing" | "danger" | "general" | "members";

type WorkspaceRole = "owner" | "admin" | "member";

type WorkspaceSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_path: string | null;
  created_at: string;
};

type WorkspaceMembership = {
  workspace_id: string;
  role: WorkspaceRole;
};

type WorkspaceMemberRecord = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
};

type ProfileRecord = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export type WorkspaceSettingsSearchParams = {
  inviteLink?: string | string[];
  inviteMessage?: string | string[];
  inviteType?: string | string[];
  message?: string | string[];
  tab?: string | string[];
  type?: string | string[];
  workspace?: string | string[];
};

export type WorkspaceMemberView = {
  avatarUrl: string | null;
  displayName: string;
  joinedAt: string;
  role: WorkspaceRole;
  userId: string;
};

export type TransferCandidate = {
  displayName: string;
  role: "admin" | "member";
  userId: string;
};

export type WorkspaceSettingsData = {
  canLeaveWorkspace: boolean;
  currentUserId: string;
  invites: WorkspaceInviteSummary[];
  members: WorkspaceMemberView[];
  selectedRole: WorkspaceRole | null;
  selectedWorkspace: WorkspaceSummary | null;
  transferCandidates: TransferCandidate[];
  workspaces: WorkspaceSummary[];
};

function isTransferEligibleMember(
  member: WorkspaceMemberView,
  currentUserId: string,
): member is WorkspaceMemberView & { role: "admin" | "member" } {
  if (member.userId === currentUserId) {
    return false;
  }

  return member.role === "admin" || member.role === "member";
}

function resolveFallbackName(params: {
  userId: string;
  userName: string | null;
}): string {
  if (params.userName && params.userName.trim().length > 0) {
    return params.userName.trim();
  }

  return `user-${params.userId.slice(0, 8)}`;
}

function parseSettingsTab(value: string | undefined): WorkspaceSettingsTab {
  if (value === "billing" || value === "danger" || value === "general" || value === "members") {
    return value;
  }

  return "general";
}

export async function resolveWorkspaceSettingsSearchParams(
  searchParams: WorkspaceSettingsSearchParams | Promise<WorkspaceSettingsSearchParams> | undefined,
): Promise<WorkspaceSettingsSearchParams> {
  if (!searchParams) {
    return {};
  }

  if (isPromise(searchParams)) {
    return (await searchParams) ?? {};
  }

  return searchParams;
}

export function resolveSettingsTabFromParams(
  searchParams: WorkspaceSettingsSearchParams,
): WorkspaceSettingsTab {
  return parseSettingsTab(getFirstQueryParamValue(searchParams.tab));
}

export function resolveMessageType(
  value: string | undefined,
): "error" | "success" {
  return value === "error" ? "error" : "success";
}

export async function loadWorkspaceSettingsData(params: {
  requestedWorkspaceSlug: string | undefined;
  userId: string;
}): Promise<WorkspaceSettingsData> {
  const supabase = await createServerSupabaseClient();

  const { data: memberships, error: membershipsError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", params.userId);

  if (membershipsError) {
    throw new Error(`Failed to load memberships: ${membershipsError.message}`);
  }

  const typedMemberships = (memberships ?? []) as WorkspaceMembership[];
  const workspaceIds = typedMemberships.map((membership) => membership.workspace_id);

  if (workspaceIds.length < 1) {
    return {
      canLeaveWorkspace: false,
      currentUserId: params.userId,
      invites: [],
      members: [],
      selectedRole: null,
      selectedWorkspace: null,
      transferCandidates: [],
      workspaces: [],
    };
  }

  const { data: workspaceRows, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, slug, name, description, logo_path, created_at")
    .in("id", workspaceIds)
    .order("created_at", { ascending: false });

  if (workspaceError) {
    throw new Error(`Failed to load workspaces: ${workspaceError.message}`);
  }

  const workspaces = (workspaceRows ?? []) as WorkspaceSummary[];
  const roleByWorkspaceId = new Map(
    typedMemberships.map((membership) => [membership.workspace_id, membership.role]),
  );

  const availableWorkspaceSlugs = new Set(workspaces.map((workspace) => workspace.slug));
  const selectedWorkspaceSlug =
    params.requestedWorkspaceSlug && availableWorkspaceSlugs.has(params.requestedWorkspaceSlug)
      ? params.requestedWorkspaceSlug
      : workspaces[0]?.slug;
  const selectedWorkspace = workspaces.find((workspace) => workspace.slug === selectedWorkspaceSlug) ?? null;

  if (!selectedWorkspace) {
    return {
      canLeaveWorkspace: false,
      currentUserId: params.userId,
      invites: [],
      members: [],
      selectedRole: null,
      selectedWorkspace: null,
      transferCandidates: [],
      workspaces,
    };
  }

  const selectedRole = roleByWorkspaceId.get(selectedWorkspace.id) ?? null;
  const canManageInvites = selectedRole === "owner" || selectedRole === "admin";

  const [{ data: memberRows, error: memberError }, invites] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("workspace_id, user_id, role, joined_at")
      .eq("workspace_id", selectedWorkspace.id)
      .order("joined_at", { ascending: true }),
    getWorkspaceInvites(supabase, selectedWorkspace.id, canManageInvites),
  ]);

  if (memberError) {
    throw new Error(`Failed to load workspace members: ${memberError.message}`);
  }

  const typedMembers = (memberRows ?? []) as WorkspaceMemberRecord[];
  const memberUserIds = typedMembers.map((member) => member.user_id);

  const { data: profileRows, error: profileError } = memberUserIds.length > 0
    ? await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", memberUserIds)
    : { data: [], error: null };

  if (profileError) {
    throw new Error(`Failed to load profile names: ${profileError.message}`);
  }

  const profileByUserId = new Map(
    ((profileRows ?? []) as ProfileRecord[]).map((profile) => [profile.id, profile]),
  );

  const members: WorkspaceMemberView[] = typedMembers.map((member) => {
    const profile = profileByUserId.get(member.user_id);
    return {
      avatarUrl: profile?.avatar_url ?? null,
      displayName: resolveFallbackName({
        userId: member.user_id,
        userName: profile?.display_name ?? null,
      }),
      joinedAt: member.joined_at,
      role: member.role,
      userId: member.user_id,
    };
  });

  const transferCandidates: TransferCandidate[] = members
    .filter((member) => isTransferEligibleMember(member, params.userId))
    .map((member) => ({
      displayName: member.displayName,
      role: member.role,
      userId: member.userId,
    }));

  return {
    canLeaveWorkspace: selectedRole === "admin" || selectedRole === "member",
    currentUserId: params.userId,
    invites,
    members,
    selectedRole,
    selectedWorkspace,
    transferCandidates,
    workspaces,
  };
}
