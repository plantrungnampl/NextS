import { createServerSupabaseClient } from "@/lib/supabase";

import type {
  SearchBootstrapPayload,
  SearchLabelOption,
  SearchMemberOption,
  WorkspaceOption,
} from "./search-types";
import type { BoardScopeRow, SupabaseServerClient, WorkspaceScope } from "./search-service.types";

export async function resolveWorkspaceScope(
  supabase: SupabaseServerClient,
  userId: string,
  workspaceSlug?: string,
): Promise<WorkspaceScope> {
  const { data: membershipRows } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);
  const workspaceIds = ((membershipRows ?? []) as { workspace_id: string }[])
    .map((row) => row.workspace_id);

  if (workspaceIds.length < 1) {
    return {
      scopedWorkspaces: [],
      workspaceById: new Map(),
      workspaceIds: [],
    };
  }

  const { data: workspaceRows } = await supabase
    .from("workspaces")
    .select("id, slug, name")
    .in("id", workspaceIds)
    .order("name", { ascending: true });

  const typedWorkspaces = (workspaceRows ?? []) as WorkspaceOption[];
  const workspaceById = new Map(typedWorkspaces.map((workspace) => [workspace.id, workspace]));

  if (!workspaceSlug || workspaceSlug.trim().length < 1) {
    return {
      scopedWorkspaces: typedWorkspaces,
      workspaceById,
      workspaceIds: typedWorkspaces.map((workspace) => workspace.id),
    };
  }

  const scopedWorkspace = typedWorkspaces.find((workspace) => workspace.slug === workspaceSlug.trim());
  if (!scopedWorkspace) {
    return {
      scopedWorkspaces: [],
      workspaceById,
      workspaceIds: [],
    };
  }

  return {
    scopedWorkspaces: [scopedWorkspace],
    workspaceById,
    workspaceIds: [scopedWorkspace.id],
  };
}

export async function loadBoardScope(
  supabase: SupabaseServerClient,
  workspaceIds: string[],
): Promise<BoardScopeRow[]> {
  if (workspaceIds.length < 1) {
    return [];
  }

  const { data } = await supabase
    .from("boards")
    .select("id, workspace_id, name, updated_at")
    .in("workspace_id", workspaceIds)
    .is("archived_at", null);

  return (data ?? []) as BoardScopeRow[];
}

async function loadSearchMemberOptions(
  supabase: SupabaseServerClient,
  workspaces: WorkspaceOption[],
): Promise<Record<string, SearchMemberOption[]>> {
  if (workspaces.length < 1) {
    return {};
  }

  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const workspaceSlugById = new Map(workspaces.map((workspace) => [workspace.id, workspace.slug]));
  const { data: membershipRows } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id")
    .in("workspace_id", workspaceIds);

  const typedMemberships = (membershipRows ?? []) as Array<{ user_id: string; workspace_id: string }>;
  const uniqueUserIds = Array.from(new Set(typedMemberships.map((membership) => membership.user_id)));
  if (uniqueUserIds.length < 1) {
    return {};
  }

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", uniqueUserIds);
  const profileById = new Map(
    ((profileRows ?? []) as Array<{ avatar_url: string | null; display_name: string | null; id: string }>)
      .map((profile) => [profile.id, profile]),
  );

  const grouped = new Map<string, SearchMemberOption[]>();
  for (const membership of typedMemberships) {
    const workspaceSlug = workspaceSlugById.get(membership.workspace_id);
    if (!workspaceSlug) {
      continue;
    }

    const profile = profileById.get(membership.user_id);
    const displayName = profile?.display_name?.trim() || `user-${membership.user_id.slice(0, 8)}`;
    const current = grouped.get(workspaceSlug) ?? [];
    if (current.some((member) => member.id === membership.user_id)) {
      continue;
    }

    current.push({
      avatarUrl: profile?.avatar_url ?? null,
      displayName,
      id: membership.user_id,
    });
    grouped.set(workspaceSlug, current);
  }

  const output: Record<string, SearchMemberOption[]> = {};
  for (const [workspaceSlug, members] of grouped.entries()) {
    output[workspaceSlug] = members.sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    );
  }

  return output;
}

async function loadSearchLabelOptions(
  supabase: SupabaseServerClient,
  workspaces: WorkspaceOption[],
): Promise<Record<string, SearchLabelOption[]>> {
  if (workspaces.length < 1) {
    return {};
  }

  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const workspaceSlugById = new Map(workspaces.map((workspace) => [workspace.id, workspace.slug]));
  const { data: labelRows } = await supabase
    .from("labels")
    .select("id, workspace_id, name, color")
    .in("workspace_id", workspaceIds)
    .order("name", { ascending: true });

  const typedRows = (labelRows ?? []) as Array<{ color: string; id: string; name: string; workspace_id: string }>;
  const grouped = new Map<string, SearchLabelOption[]>();

  for (const row of typedRows) {
    const workspaceSlug = workspaceSlugById.get(row.workspace_id);
    if (!workspaceSlug) {
      continue;
    }

    const current = grouped.get(workspaceSlug) ?? [];
    current.push({
      color: row.color,
      id: row.id,
      name: row.name,
    });
    grouped.set(workspaceSlug, current);
  }

  const output: Record<string, SearchLabelOption[]> = {};
  for (const [workspaceSlug, labels] of grouped.entries()) {
    output[workspaceSlug] = labels.sort((left, right) => left.name.localeCompare(right.name));
  }

  return output;
}

export async function loadSearchBootstrap(userId: string): Promise<SearchBootstrapPayload> {
  const supabase = await createServerSupabaseClient();
  const scope = await resolveWorkspaceScope(supabase, userId);
  const [memberOptionsByWorkspaceSlug, labelOptionsByWorkspaceSlug] = await Promise.all([
    loadSearchMemberOptions(supabase, scope.scopedWorkspaces),
    loadSearchLabelOptions(supabase, scope.scopedWorkspaces),
  ]);

  return {
    labelOptionsByWorkspaceSlug,
    memberOptionsByWorkspaceSlug,
    viewerId: userId,
    workspaces: scope.scopedWorkspaces,
  };
}
