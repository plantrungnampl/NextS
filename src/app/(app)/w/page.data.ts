import { APP_ROUTES } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";
import { isPromise } from "@/shared";

export type WorkspacePageSearchParams = {
  createBoard?: string | string[];
  createBoardMessage?: string | string[];
  createBoardType?: string | string[];
  inviteLink?: string | string[];
  inviteMessage?: string | string[];
  inviteType?: string | string[];
  message?: string | string[];
  type?: string | string[];
  workspace?: string | string[];
};

export type WorkspaceInviteSummary = {
  accepted_at: string | null;
  created_at: string;
  expires_at: string;
  id: string;
  invited_email: string;
  invited_role: "owner" | "admin" | "member";
  status: "pending" | "accepted" | "revoked" | "expired";
};

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export function createBoardDialogHref(workspaceSlug?: string): string {
  const searchParams = new URLSearchParams({
    createBoard: "1",
  });

  if (workspaceSlug) {
    searchParams.set("workspace", workspaceSlug);
  }

  return `${APP_ROUTES.workspace.index}?${searchParams.toString()}`;
}

export async function resolveWorkspaceSearchParams(
  searchParams: WorkspacePageSearchParams | Promise<WorkspacePageSearchParams> | undefined,
): Promise<WorkspacePageSearchParams> {
  if (!searchParams) {
    return {};
  }

  if (isPromise(searchParams)) {
    return (await searchParams) ?? {};
  }

  return searchParams;
}

export async function getWorkspaceInvites(
  supabase: ServerSupabaseClient,
  workspaceId: string | undefined,
  canManageInvites: boolean,
): Promise<WorkspaceInviteSummary[]> {
  if (!workspaceId || !canManageInvites) {
    return [];
  }

  const { data, error } = await supabase
    .from("invites")
    .select("id, invited_email, invited_role, status, created_at, expires_at, accepted_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to load invites: ${error.message}`);
  }

  return (data ?? []) as WorkspaceInviteSummary[];
}
