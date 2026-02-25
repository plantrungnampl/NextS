import "server-only";

import { redirect } from "next/navigation";
import { z } from "zod";

import { APP_ROUTES } from "@/core";
import { getOptionalAuthContext } from "@/lib/auth/server";
import { inviteExpiryFromNow, normalizeInviteEmail } from "@/lib/invites";
import { createServerSupabaseClient } from "@/lib/supabase";

export type WorkspaceRole = "owner" | "admin" | "member";

type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

type WorkspaceMembership = {
  role: WorkspaceRole;
  workspace_id: string;
};

type WorkspaceRecord = {
  id: string;
  slug: string;
};

export type InviteRecord = {
  id: string;
  invited_email: string;
  invited_role: WorkspaceRole;
  status: InviteStatus;
};

const manageInviteSchema = z.object({
  workspaceSlug: z.string().trim().min(3).max(64),
});

export const createInviteSchema = manageInviteSchema.extend({
  invitedEmail: z.email().trim().toLowerCase(),
  invitedRole: z.enum(["admin", "member"]),
});

export const updateInviteSchema = manageInviteSchema.extend({
  inviteId: z.string().uuid(),
});

function buildLoginPath(workspaceSlug: string): string {
  const searchParams = new URLSearchParams({
    next: `${APP_ROUTES.workspace.invites}?workspace=${workspaceSlug}`,
  });
  return `${APP_ROUTES.login}?${searchParams.toString()}`;
}

export function withInviteMessage(
  workspaceSlug: string,
  message: string,
  type: "error" | "success",
  inviteLink?: string,
): string {
  const searchParams = new URLSearchParams({
    inviteMessage: message,
    inviteType: type,
    workspace: workspaceSlug,
  });

  if (inviteLink) {
    searchParams.set("inviteLink", inviteLink);
  }

  return `${APP_ROUTES.workspace.invites}?${searchParams.toString()}`;
}

export async function resolveAdminWorkspaceContext(workspaceSlug: string): Promise<{
  role: WorkspaceRole;
  userEmail: string;
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
}> {
  const authContext = await getOptionalAuthContext();
  if (!authContext) {
    redirect(buildLoginPath(workspaceSlug));
  }

  const supabase = await createServerSupabaseClient();

  const userEmail = normalizeInviteEmail(authContext.email ?? "");
  if (!userEmail) {
    redirect(withInviteMessage(workspaceSlug, "Your account email is missing.", "error"));
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, slug")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (workspaceError || !workspace) {
    redirect(withInviteMessage(workspaceSlug, "Workspace not found.", "error"));
  }

  const typedWorkspace = workspace as WorkspaceRecord;
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("workspace_id", typedWorkspace.id)
    .eq("user_id", authContext.userId)
    .maybeSingle();

  if (membershipError || !membership) {
    redirect(withInviteMessage(workspaceSlug, "Membership is required for this workspace.", "error"));
  }

  const typedMembership = membership as WorkspaceMembership;
  if (![
    "owner",
    "admin",
  ].includes(typedMembership.role)) {
    redirect(withInviteMessage(workspaceSlug, "Only owner/admin can manage invites.", "error"));
  }

  return {
    role: typedMembership.role,
    userEmail,
    userId: authContext.userId,
    workspaceId: typedWorkspace.id,
    workspaceSlug: typedWorkspace.slug,
  };
}

export async function hasMemberByEmail(workspaceId: string, invitedEmail: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("workspace_has_member_email", {
    target_email: invitedEmail,
    target_workspace_id: workspaceId,
  });

  if (error) {
    if (error.code === "42883") {
      return false;
    }

    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function upsertPendingInvite(payload: {
  invitedEmail: string;
  invitedRole: "admin" | "member";
  tokenHash: string;
  userId: string;
  workspaceId: string;
}): Promise<{ inviteId: string; mode: "created" | "updated" }> {
  const supabase = await createServerSupabaseClient();
  const expiresAt = inviteExpiryFromNow();

  const { data: existingPending, error: existingError } = await supabase
    .from("invites")
    .select("id")
    .eq("workspace_id", payload.workspaceId)
    .eq("status", "pending")
    .ilike("invited_email", payload.invitedEmail)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const typedExistingPending = existingPending as { id: string } | null;
  if (typedExistingPending) {
    const { data: updatedInvite, error: updateError } = await supabase
      .from("invites")
      .update({
        expires_at: expiresAt,
        invited_by: payload.userId,
        invited_email: payload.invitedEmail,
        invited_role: payload.invitedRole,
        token_hash: payload.tokenHash,
      })
      .eq("id", typedExistingPending.id)
      .select("id")
      .single();

    if (updateError || !updatedInvite) {
      throw new Error(updateError?.message ?? "Could not refresh pending invite.");
    }

    return {
      inviteId: (updatedInvite as { id: string }).id,
      mode: "updated",
    };
  }

  const { data: createdInvite, error: insertError } = await supabase
    .from("invites")
    .insert({
      expires_at: expiresAt,
      invited_by: payload.userId,
      invited_email: payload.invitedEmail,
      invited_role: payload.invitedRole,
      token_hash: payload.tokenHash,
      workspace_id: payload.workspaceId,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code !== "23505") {
      throw new Error(insertError.message);
    }

    const { data: refreshedInvite, error: refreshError } = await supabase
      .from("invites")
      .update({
        expires_at: expiresAt,
        invited_by: payload.userId,
        invited_email: payload.invitedEmail,
        invited_role: payload.invitedRole,
        token_hash: payload.tokenHash,
      })
      .eq("workspace_id", payload.workspaceId)
      .eq("status", "pending")
      .ilike("invited_email", payload.invitedEmail)
      .select("id")
      .single();

    if (refreshError || !refreshedInvite) {
      throw new Error(refreshError?.message ?? "Could not refresh pending invite.");
    }

    return {
      inviteId: (refreshedInvite as { id: string }).id,
      mode: "updated",
    };
  }

  return {
    inviteId: (createdInvite as { id: string }).id,
    mode: "created",
  };
}

export async function fetchInviteForAdmin(
  workspaceId: string,
  inviteId: string,
): Promise<InviteRecord> {
  const supabase = await createServerSupabaseClient();
  const { data: invite, error } = await supabase
    .from("invites")
    .select("id, invited_email, invited_role, status")
    .eq("workspace_id", workspaceId)
    .eq("id", inviteId)
    .maybeSingle();

  if (error || !invite) {
    throw new Error(error?.message ?? "Invite not found.");
  }

  return invite as InviteRecord;
}

export async function logInviteActivity(payload: {
  action: string;
  entityId: string;
  metadata: Record<string, unknown>;
  userId: string;
  workspaceId: string;
}) {
  const supabase = await createServerSupabaseClient();
  await supabase.from("activity_events").insert({
    action: payload.action,
    actor_id: payload.userId,
    entity_id: payload.entityId,
    entity_type: "member",
    metadata: payload.metadata,
    workspace_id: payload.workspaceId,
  });
}
