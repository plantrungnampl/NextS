import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { APP_ROUTES, sanitizeUserText } from "@/core";
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
  RateLimitExceededError,
} from "@/core/security/rate-limit";
import { normalizeInviteEmail } from "@/lib/invites";
import { getOptionalAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";

import { fetchInviteForAdmin } from "../invites/actions.shared";

export type WorkspaceRole = "admin" | "member" | "owner";
export type WorkspaceTab = "danger" | "general" | "members";

export type WorkspaceRecord = {
  id: string;
  logo_path: string | null;
  name: string;
  slug: string;
};

type WorkspaceMembershipRecord = {
  role: WorkspaceRole;
};

export type MemberRecord = {
  role: WorkspaceRole;
  user_id: string;
};

export const WORKSPACE_LOGO_BUCKET = "workspace-logos";
export const WORKSPACE_LOGO_MAX_BYTES = 5 * 1024 * 1024;

export const baseWorkspaceSchema = z.object({
  workspaceSlug: z.string().trim().min(3).max(64),
});

export const updateWorkspaceCoreSchema = baseWorkspaceSchema.extend({
  description: z.string().max(800).optional().nullable(),
  name: z.string().trim().min(3).max(120),
  slug: z.string().trim().min(3).max(64),
});

export const createInviteSchema = baseWorkspaceSchema.extend({
  invitedEmail: z.email().trim().toLowerCase(),
  invitedRole: z.enum(["admin", "member"]),
});

export const updateInviteSchema = baseWorkspaceSchema.extend({
  inviteId: z.string().uuid(),
});

export const updateMemberRoleSchema = baseWorkspaceSchema.extend({
  memberUserId: z.string().uuid(),
  nextRole: z.enum(["admin", "member"]),
});

export const removeMemberSchema = baseWorkspaceSchema.extend({
  memberUserId: z.string().uuid(),
});

export const transferOwnershipSchema = baseWorkspaceSchema.extend({
  confirmChecked: z.boolean(),
  confirmSlug: z.string().trim().min(3).max(64),
  newOwnerUserId: z.string().uuid(),
});

export const deleteWorkspaceSchema = baseWorkspaceSchema.extend({
  confirmChecked: z.boolean(),
  confirmSlug: z.string().trim().min(3).max(64),
});

export const leaveWorkspaceSchema = baseWorkspaceSchema.extend({
  confirmChecked: z.boolean(),
  confirmSlug: z.string().trim().min(3).max(64),
});

export function settingsHref(params: {
  message?: string;
  tab: WorkspaceTab;
  type?: "error" | "success";
  workspaceSlug: string;
}): string {
  const searchParams = new URLSearchParams({
    tab: params.tab,
    workspace: params.workspaceSlug,
  });

  if (params.message) {
    searchParams.set("message", params.message);
  }

  if (params.type) {
    searchParams.set("type", params.type);
  }

  return `${APP_ROUTES.workspace.settings}?${searchParams.toString()}`;
}

export function settingsInviteHref(params: {
  inviteLink?: string;
  message: string;
  type: "error" | "success";
  workspaceSlug: string;
}): string {
  const searchParams = new URLSearchParams({
    inviteMessage: params.message,
    inviteType: params.type,
    tab: "members",
    workspace: params.workspaceSlug,
  });

  if (params.inviteLink) {
    searchParams.set("inviteLink", params.inviteLink);
  }

  return `${APP_ROUTES.workspace.settings}?${searchParams.toString()}`;
}

export function dashboardHref(params: {
  message?: string;
  type?: "error" | "success";
}): string {
  if (!params.message || !params.type) {
    return APP_ROUTES.workspace.index;
  }

  const searchParams = new URLSearchParams({
    message: params.message,
    type: params.type,
  });

  return `${APP_ROUTES.workspace.index}?${searchParams.toString()}`;
}

export function slugifyWorkspace(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sanitizeLogoFileName(value: string): string {
  const trimmed = sanitizeUserText(value).replace(/\s+/g, "-");
  const safe = trimmed
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);

  return safe.length > 0 ? safe : "workspace-logo";
}

export function toBooleanCheckbox(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return value === "on" || value === "true" || value === "1";
}

export function parseFile(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof File)) {
    return null;
  }

  if (!value.name || value.size < 1) {
    return null;
  }

  return value;
}

function assertWorkspaceMemberRole(role: WorkspaceRole | null | undefined): role is WorkspaceRole {
  return role === "owner" || role === "admin" || role === "member";
}

export async function resolveWorkspaceActor(workspaceSlug: string): Promise<{
  membershipRole: WorkspaceRole;
  userEmail: string;
  userId: string;
  workspace: WorkspaceRecord;
}> {
  const authContext = await getOptionalAuthContext();
  if (!authContext) {
    const searchParams = new URLSearchParams({
      next: APP_ROUTES.workspace.settingsBySlug(workspaceSlug),
    });
    redirect(`${APP_ROUTES.login}?${searchParams.toString()}`);
  }

  const userEmail = normalizeInviteEmail(authContext.email ?? "");
  const supabase = await createServerSupabaseClient();

  const { data: workspaceRow, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, slug, name, logo_path")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (workspaceError || !workspaceRow) {
    redirect(dashboardHref({ message: "Workspace không tồn tại.", type: "error" }));
  }

  const workspace = workspaceRow as WorkspaceRecord;

  const { data: membershipRow, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", authContext.userId)
    .maybeSingle();

  if (membershipError || !membershipRow) {
    redirect(dashboardHref({ message: "Bạn không thuộc workspace này.", type: "error" }));
  }

  const membershipRole = (membershipRow as WorkspaceMembershipRecord).role;
  if (!assertWorkspaceMemberRole(membershipRole)) {
    redirect(dashboardHref({ message: "Role workspace không hợp lệ.", type: "error" }));
  }

  return {
    membershipRole,
    userEmail,
    userId: authContext.userId,
    workspace,
  };
}

export function assertWorkspaceAdmin(context: {
  membershipRole: WorkspaceRole;
  workspaceSlug: string;
}, tab: WorkspaceTab) {
  if (context.membershipRole === "owner" || context.membershipRole === "admin") {
    return;
  }

  redirect(settingsHref({
    message: "Bạn không có quyền thực hiện thao tác này.",
    tab,
    type: "error",
    workspaceSlug: context.workspaceSlug,
  }));
}

export function assertWorkspaceOwner(context: {
  membershipRole: WorkspaceRole;
  workspaceSlug: string;
}, tab: WorkspaceTab) {
  if (context.membershipRole === "owner") {
    return;
  }

  redirect(settingsHref({
    message: "Chỉ owner mới có quyền thực hiện thao tác này.",
    tab,
    type: "error",
    workspaceSlug: context.workspaceSlug,
  }));
}

export async function enforceWorkspaceMutationRateLimit(params: {
  action: string;
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
}) {
  const supabase = await createServerSupabaseClient();

  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.workspaceMutation,
      subjectParts: [
        `workspace:${params.workspaceId}`,
        `user:${params.userId}`,
        `action:${params.action}`,
      ],
      supabase,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      redirect(settingsHref({
        message: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${error.retryAfterSeconds}s.`,
        tab: "general",
        type: "error",
        workspaceSlug: params.workspaceSlug,
      }));
    }

    throw error;
  }
}

export async function logWorkspaceActivity(params: {
  action: string;
  metadata?: Record<string, unknown>;
  userId: string;
  workspaceId: string;
}) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("activity_events").insert({
    action: params.action,
    actor_id: params.userId,
    entity_id: params.workspaceId,
    entity_type: "workspace",
    metadata: params.metadata ?? {},
    workspace_id: params.workspaceId,
  });

  if (error) {
    console.warn("[workspace-settings] activity insert failed", {
      action: params.action,
      message: error.message,
      workspaceId: params.workspaceId,
    });
  }
}

export async function resolveMemberRecord(params: {
  memberUserId: string;
  workspaceId: string;
}): Promise<MemberRecord> {
  const supabase = await createServerSupabaseClient();

  const { data: memberRow, error } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", params.workspaceId)
    .eq("user_id", params.memberUserId)
    .maybeSingle();

  if (error || !memberRow) {
    throw new Error("Không tìm thấy thành viên trong workspace.");
  }

  return memberRow as MemberRecord;
}

export async function resolvePendingInvite(params: {
  inviteId: string;
  workspaceId: string;
}): Promise<Awaited<ReturnType<typeof fetchInviteForAdmin>>> {
  const invite = await fetchInviteForAdmin(params.workspaceId, params.inviteId);

  if (invite.status !== "pending") {
    throw new Error("Chỉ có thể thao tác với lời mời đang chờ.");
  }

  return invite;
}

export function revalidateWorkspaceSurfaces() {
  revalidatePath(APP_ROUTES.workspace.index);
  revalidatePath(APP_ROUTES.workspace.settings);
  revalidatePath(APP_ROUTES.workspace.invites);
}
