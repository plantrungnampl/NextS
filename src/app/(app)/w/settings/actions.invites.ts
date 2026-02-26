"use server";

import { redirect } from "next/navigation";

import {
  buildInviteLink,
  generateInviteToken,
  hashInviteToken,
  normalizeInviteEmail,
} from "@/lib/invites";
import { createServerSupabaseClient } from "@/lib/supabase";

import { getInviteManageRetryAfterSeconds } from "../invites/actions.rate-limit";
import {
  hasMemberByEmail,
  logInviteActivity,
  upsertPendingInvite,
} from "../invites/actions.shared";
import {
  assertWorkspaceAdmin,
  createInviteSchema,
  revalidateWorkspaceSurfaces,
  resolvePendingInvite,
  resolveWorkspaceActor,
  settingsInviteHref,
  updateInviteSchema,
} from "./actions.shared";

export async function createWorkspaceInviteFromSettingsAction(formData: FormData) {
  const parsed = createInviteSchema.safeParse({
    invitedEmail: formData.get("invitedEmail"),
    invitedRole: formData.get("invitedRole"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const fallbackWorkspaceSlug = typeof formData.get("workspaceSlug") === "string"
    ? String(formData.get("workspaceSlug"))
    : "";

  if (!parsed.success) {
    redirect(settingsInviteHref({
      message: "Email hoặc role lời mời không hợp lệ.",
      type: "error",
      workspaceSlug: fallbackWorkspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(parsed.data.workspaceSlug);
  assertWorkspaceAdmin({ membershipRole: context.membershipRole, workspaceSlug: context.workspace.slug }, "members");

  const retryAfterSeconds = await getInviteManageRetryAfterSeconds({
    action: "create",
    userId: context.userId,
    workspaceId: context.workspace.id,
  });
  if (retryAfterSeconds) {
    redirect(settingsInviteHref({
      message: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfterSeconds}s.`,
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const invitedEmail = normalizeInviteEmail(parsed.data.invitedEmail);
  if (!invitedEmail) {
    redirect(settingsInviteHref({
      message: "Email lời mời không hợp lệ.",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  if (invitedEmail === context.userEmail) {
    redirect(settingsInviteHref({
      message: "Bạn không thể tự mời chính mình.",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  try {
    const alreadyMember = await hasMemberByEmail(context.workspace.id, invitedEmail);
    if (alreadyMember) {
      redirect(settingsInviteHref({
        message: "Người dùng này đã là thành viên của workspace.",
        type: "error",
        workspaceSlug: context.workspace.slug,
      }));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể xác thực email lời mời.";
    redirect(settingsInviteHref({
      message,
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);

  try {
    const inviteResult = await upsertPendingInvite({
      invitedEmail,
      invitedRole: parsed.data.invitedRole,
      tokenHash,
      userId: context.userId,
      workspaceId: context.workspace.id,
    });

    await logInviteActivity({
      action: inviteResult.mode === "created" ? "invite.created" : "invite.updated",
      entityId: inviteResult.inviteId,
      metadata: {
        invitedEmail,
        invitedRole: parsed.data.invitedRole,
      },
      userId: context.userId,
      workspaceId: context.workspace.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo lời mời.";
    redirect(settingsInviteHref({
      message,
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  revalidateWorkspaceSurfaces();
  redirect(settingsInviteHref({
    inviteLink: buildInviteLink(rawToken),
    message: "Đã tạo liên kết mời thành công.",
    type: "success",
    workspaceSlug: context.workspace.slug,
  }));
}

export async function resendWorkspaceInviteFromSettingsAction(formData: FormData) {
  const parsed = updateInviteSchema.safeParse({
    inviteId: formData.get("inviteId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const fallbackWorkspaceSlug = typeof formData.get("workspaceSlug") === "string"
    ? String(formData.get("workspaceSlug"))
    : "";

  if (!parsed.success) {
    redirect(settingsInviteHref({
      message: "Yêu cầu lời mời không hợp lệ.",
      type: "error",
      workspaceSlug: fallbackWorkspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(parsed.data.workspaceSlug);
  assertWorkspaceAdmin({ membershipRole: context.membershipRole, workspaceSlug: context.workspace.slug }, "members");

  const retryAfterSeconds = await getInviteManageRetryAfterSeconds({
    action: "resend",
    userId: context.userId,
    workspaceId: context.workspace.id,
  });
  if (retryAfterSeconds) {
    redirect(settingsInviteHref({
      message: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfterSeconds}s.`,
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  try {
    await resolvePendingInvite({
      inviteId: parsed.data.inviteId,
      workspaceId: context.workspace.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể làm mới lời mời.";
    redirect(settingsInviteHref({
      message,
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("invites")
    .update({
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      invited_by: context.userId,
      token_hash: tokenHash,
    })
    .eq("id", parsed.data.inviteId)
    .eq("workspace_id", context.workspace.id)
    .eq("status", "pending");

  if (error) {
    redirect(settingsInviteHref({
      message: error.message,
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  await logInviteActivity({
    action: "invite.resent",
    entityId: parsed.data.inviteId,
    metadata: {},
    userId: context.userId,
    workspaceId: context.workspace.id,
  });

  revalidateWorkspaceSurfaces();
  redirect(settingsInviteHref({
    inviteLink: buildInviteLink(rawToken),
    message: "Đã làm mới liên kết mời.",
    type: "success",
    workspaceSlug: context.workspace.slug,
  }));
}

export async function revokeWorkspaceInviteFromSettingsAction(formData: FormData) {
  const parsed = updateInviteSchema.safeParse({
    inviteId: formData.get("inviteId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const fallbackWorkspaceSlug = typeof formData.get("workspaceSlug") === "string"
    ? String(formData.get("workspaceSlug"))
    : "";

  if (!parsed.success) {
    redirect(settingsInviteHref({
      message: "Yêu cầu lời mời không hợp lệ.",
      type: "error",
      workspaceSlug: fallbackWorkspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(parsed.data.workspaceSlug);
  assertWorkspaceAdmin({ membershipRole: context.membershipRole, workspaceSlug: context.workspace.slug }, "members");

  const retryAfterSeconds = await getInviteManageRetryAfterSeconds({
    action: "revoke",
    userId: context.userId,
    workspaceId: context.workspace.id,
  });
  if (retryAfterSeconds) {
    redirect(settingsInviteHref({
      message: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfterSeconds}s.`,
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  let invite;
  try {
    invite = await resolvePendingInvite({
      inviteId: parsed.data.inviteId,
      workspaceId: context.workspace.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể thu hồi lời mời.";
    redirect(settingsInviteHref({
      message,
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("invites")
    .update({ status: "revoked" })
    .eq("id", parsed.data.inviteId)
    .eq("workspace_id", context.workspace.id)
    .eq("status", "pending");

  if (error) {
    redirect(settingsInviteHref({
      message: error.message,
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  await logInviteActivity({
    action: "invite.revoked",
    entityId: parsed.data.inviteId,
    metadata: {
      invitedEmail: invite.invited_email,
    },
    userId: context.userId,
    workspaceId: context.workspace.id,
  });

  revalidateWorkspaceSurfaces();
  redirect(settingsInviteHref({
    message: "Đã thu hồi lời mời.",
    type: "success",
    workspaceSlug: context.workspace.slug,
  }));
}
