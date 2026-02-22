"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/core";
import { buildInviteLink, generateInviteToken, hashInviteToken, normalizeInviteEmail } from "@/lib/invites";

import { getInviteManageRetryAfterSeconds } from "./actions.rate-limit";
import {
  createInviteSchema,
  hasMemberByEmail,
  logInviteActivity,
  resolveAdminWorkspaceContext,
  upsertPendingInvite,
  withInviteMessage,
} from "./actions.shared";

async function enforceCreateInviteRateLimit(
  context: { userId: string; workspaceId: string; workspaceSlug: string },
): Promise<void> {
  const retryAfterSeconds = await getInviteManageRetryAfterSeconds({
    action: "create",
    userId: context.userId,
    workspaceId: context.workspaceId,
  });

  if (!retryAfterSeconds) {
    return;
  }

  redirect(
    withInviteMessage(
      context.workspaceSlug,
      `Too many invite actions. Try again in ${retryAfterSeconds}s.`,
      "error",
    ),
  );
}

async function validateCreateInviteTarget(params: {
  context: { userEmail: string; userId: string; workspaceId: string; workspaceSlug: string };
  rawInvitedEmail: string;
}): Promise<string> {
  const invitedEmail = normalizeInviteEmail(params.rawInvitedEmail);

  if (invitedEmail === params.context.userEmail) {
    redirect(withInviteMessage(params.context.workspaceSlug, "You cannot invite your own account.", "error"));
  }

  try {
    const alreadyMember = await hasMemberByEmail(params.context.workspaceId, invitedEmail);
    if (alreadyMember) {
      redirect(
        withInviteMessage(
          params.context.workspaceSlug,
          "This user is already a workspace member.",
          "error",
        ),
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not validate invite email.";
    redirect(withInviteMessage(params.context.workspaceSlug, message, "error"));
  }

  return invitedEmail;
}

export async function createWorkspaceInvite(formData: FormData) {
  const rawWorkspaceSlug = formData.get("workspaceSlug");
  const fallbackWorkspaceSlug = typeof rawWorkspaceSlug === "string" ? rawWorkspaceSlug : "";
  const parsed = createInviteSchema.safeParse({
    invitedEmail: formData.get("invitedEmail"),
    invitedRole: formData.get("invitedRole"),
    workspaceSlug: rawWorkspaceSlug,
  });

  if (!parsed.success) {
    redirect(withInviteMessage(fallbackWorkspaceSlug, "Invite email and role are required.", "error"));
  }

  const context = await resolveAdminWorkspaceContext(parsed.data.workspaceSlug);
  await enforceCreateInviteRateLimit(context);
  const invitedEmail = await validateCreateInviteTarget({
    context,
    rawInvitedEmail: parsed.data.invitedEmail,
  });

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);

  try {
    const inviteResult = await upsertPendingInvite({
      invitedEmail,
      invitedRole: parsed.data.invitedRole,
      tokenHash,
      userId: context.userId,
      workspaceId: context.workspaceId,
    });

    await logInviteActivity({
      action: inviteResult.mode === "created" ? "invite.created" : "invite.updated",
      entityId: inviteResult.inviteId,
      metadata: {
        invitedEmail,
        invitedRole: parsed.data.invitedRole,
      },
      userId: context.userId,
      workspaceId: context.workspaceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create invite.";
    redirect(withInviteMessage(context.workspaceSlug, message, "error"));
  }

  revalidatePath(APP_ROUTES.workspace.index);
  redirect(
    withInviteMessage(
      context.workspaceSlug,
      "Invite link generated successfully.",
      "success",
      buildInviteLink(rawToken),
    ),
  );
}
