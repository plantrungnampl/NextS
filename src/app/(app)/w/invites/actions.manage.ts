"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/core";
import { buildInviteLink, generateInviteToken, hashInviteToken, inviteExpiryFromNow } from "@/lib/invites";
import { createServerSupabaseClient } from "@/lib/supabase";

import { getInviteManageRetryAfterSeconds } from "./actions.rate-limit";
import {
  fetchInviteForAdmin,
  type InviteRecord,
  logInviteActivity,
  resolveAdminWorkspaceContext,
  updateInviteSchema,
  withInviteMessage,
} from "./actions.shared";

type InviteAction = "resend" | "revoke";

async function enforceManageRateLimit(params: {
  action: InviteAction;
  context: { userId: string; workspaceId: string; workspaceSlug: string };
}): Promise<void> {
  const retryAfterSeconds = await getInviteManageRetryAfterSeconds({
    action: params.action,
    userId: params.context.userId,
    workspaceId: params.context.workspaceId,
  });

  if (!retryAfterSeconds) {
    return;
  }

  redirect(
    withInviteMessage(
      params.context.workspaceSlug,
      `Too many invite actions. Try again in ${retryAfterSeconds}s.`,
      "error",
    ),
  );
}

async function resolvePendingInvite(params: {
  action: InviteAction;
  context: { userId: string; workspaceId: string; workspaceSlug: string };
  inviteId: string;
}): Promise<InviteRecord> {
  let invite: InviteRecord;

  try {
    invite = await fetchInviteForAdmin(params.context.workspaceId, params.inviteId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite not found.";
    redirect(withInviteMessage(params.context.workspaceSlug, message, "error"));
  }

  if (invite.status !== "pending") {
    const message =
      params.action === "resend"
        ? "Only pending invites can be resent."
        : "Only pending invites can be revoked.";
    redirect(withInviteMessage(params.context.workspaceSlug, message, "error"));
  }

  return invite;
}

export async function resendWorkspaceInvite(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const rawWorkspaceSlug = formData.get("workspaceSlug");
  const fallbackWorkspaceSlug = typeof rawWorkspaceSlug === "string" ? rawWorkspaceSlug : "";
  const parsed = updateInviteSchema.safeParse({
    inviteId: formData.get("inviteId"),
    workspaceSlug: rawWorkspaceSlug,
  });

  if (!parsed.success) {
    redirect(withInviteMessage(fallbackWorkspaceSlug, "Invalid invite request.", "error"));
  }

  const context = await resolveAdminWorkspaceContext(parsed.data.workspaceSlug);
  await enforceManageRateLimit({ action: "resend", context });
  const invite = await resolvePendingInvite({
    action: "resend",
    context,
    inviteId: parsed.data.inviteId,
  });

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const { error: updateError } = await supabase
    .from("invites")
    .update({
      expires_at: inviteExpiryFromNow(),
      invited_by: context.userId,
      token_hash: tokenHash,
    })
    .eq("id", invite.id)
    .eq("workspace_id", context.workspaceId)
    .eq("status", "pending");

  if (updateError) {
    redirect(withInviteMessage(context.workspaceSlug, updateError.message, "error"));
  }

  await logInviteActivity({
    action: "invite.resent",
    entityId: invite.id,
    metadata: { invitedEmail: invite.invited_email },
    userId: context.userId,
    workspaceId: context.workspaceId,
  });

  revalidatePath(APP_ROUTES.workspace.index);
  redirect(
    withInviteMessage(
      context.workspaceSlug,
      "Invite link refreshed.",
      "success",
      buildInviteLink(rawToken),
    ),
  );
}

export async function revokeWorkspaceInvite(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const rawWorkspaceSlug = formData.get("workspaceSlug");
  const fallbackWorkspaceSlug = typeof rawWorkspaceSlug === "string" ? rawWorkspaceSlug : "";
  const parsed = updateInviteSchema.safeParse({
    inviteId: formData.get("inviteId"),
    workspaceSlug: rawWorkspaceSlug,
  });

  if (!parsed.success) {
    redirect(withInviteMessage(fallbackWorkspaceSlug, "Invalid invite request.", "error"));
  }

  const context = await resolveAdminWorkspaceContext(parsed.data.workspaceSlug);
  await enforceManageRateLimit({ action: "revoke", context });
  const invite = await resolvePendingInvite({
    action: "revoke",
    context,
    inviteId: parsed.data.inviteId,
  });

  const { error: updateError } = await supabase
    .from("invites")
    .update({ status: "revoked" })
    .eq("id", invite.id)
    .eq("workspace_id", context.workspaceId)
    .eq("status", "pending");

  if (updateError) {
    redirect(withInviteMessage(context.workspaceSlug, updateError.message, "error"));
  }

  await logInviteActivity({
    action: "invite.revoked",
    entityId: invite.id,
    metadata: { invitedEmail: invite.invited_email },
    userId: context.userId,
    workspaceId: context.workspaceId,
  });

  revalidatePath(APP_ROUTES.workspace.index);
  redirect(withInviteMessage(context.workspaceSlug, "Invite revoked.", "success"));
}
