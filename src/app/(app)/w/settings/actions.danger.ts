"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

import {
  assertWorkspaceOwner,
  dashboardHref,
  deleteWorkspaceSchema,
  leaveWorkspaceSchema,
  logWorkspaceActivity,
  revalidateWorkspaceSurfaces,
  resolveWorkspaceActor,
  settingsHref,
  toBooleanCheckbox,
  transferOwnershipSchema,
  WORKSPACE_LOGO_BUCKET,
} from "./actions.shared";

function getWorkspaceSlugFromForm(formData: FormData): string {
  return typeof formData.get("workspaceSlug") === "string"
    ? String(formData.get("workspaceSlug"))
    : "";
}

export async function transferWorkspaceOwnershipAction(formData: FormData) {
  const parsed = transferOwnershipSchema.safeParse({
    confirmChecked: toBooleanCheckbox(formData.get("confirmChecked")),
    confirmSlug: formData.get("confirmSlug"),
    newOwnerUserId: formData.get("newOwnerUserId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const fallbackWorkspaceSlug = getWorkspaceSlugFromForm(formData);

  if (!parsed.success) {
    redirect(settingsHref({
      message: "Yêu cầu transfer ownership không hợp lệ.",
      tab: "danger",
      type: "error",
      workspaceSlug: fallbackWorkspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(parsed.data.workspaceSlug);
  assertWorkspaceOwner({ membershipRole: context.membershipRole, workspaceSlug: context.workspace.slug }, "danger");

  if (!parsed.data.confirmChecked || parsed.data.confirmSlug !== context.workspace.slug) {
    redirect(settingsHref({
      message: "Bạn cần xác nhận slug và checkbox trước khi transfer ownership.",
      tab: "danger",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("transfer_workspace_ownership", {
    new_owner_user_id: parsed.data.newOwnerUserId,
    target_workspace_id: context.workspace.id,
  });

  if (error) {
    redirect(settingsHref({
      message: error.message,
      tab: "danger",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  await logWorkspaceActivity({
    action: "workspace.ownership.transferred",
    metadata: {
      newOwnerUserId: parsed.data.newOwnerUserId,
    },
    userId: context.userId,
    workspaceId: context.workspace.id,
  });

  revalidateWorkspaceSurfaces();
  redirect(settingsHref({
    message: "Đã chuyển quyền sở hữu workspace.",
    tab: "members",
    type: "success",
    workspaceSlug: context.workspace.slug,
  }));
}

export async function leaveWorkspaceAction(formData: FormData) {
  const parsed = leaveWorkspaceSchema.safeParse({
    confirmChecked: toBooleanCheckbox(formData.get("confirmChecked")),
    confirmSlug: formData.get("confirmSlug"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const fallbackWorkspaceSlug = getWorkspaceSlugFromForm(formData);

  if (!parsed.success) {
    redirect(settingsHref({
      message: "Yêu cầu rời workspace không hợp lệ.",
      tab: "danger",
      type: "error",
      workspaceSlug: fallbackWorkspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(parsed.data.workspaceSlug);

  if (context.membershipRole === "owner") {
    redirect(settingsHref({
      message: "Owner không thể rời workspace. Hãy transfer ownership trước.",
      tab: "danger",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  if (!parsed.data.confirmChecked || parsed.data.confirmSlug !== context.workspace.slug) {
    redirect(settingsHref({
      message: "Bạn cần xác nhận slug và checkbox trước khi rời workspace.",
      tab: "danger",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", context.workspace.id)
    .eq("user_id", context.userId);

  if (error) {
    redirect(settingsHref({
      message: error.message,
      tab: "danger",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  await logWorkspaceActivity({
    action: "workspace.member.left",
    userId: context.userId,
    workspaceId: context.workspace.id,
  });

  revalidateWorkspaceSurfaces();
  redirect(dashboardHref({
    message: "Bạn đã rời workspace.",
    type: "success",
  }));
}

export async function deleteWorkspaceAction(formData: FormData) {
  const parsed = deleteWorkspaceSchema.safeParse({
    confirmChecked: toBooleanCheckbox(formData.get("confirmChecked")),
    confirmSlug: formData.get("confirmSlug"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const fallbackWorkspaceSlug = getWorkspaceSlugFromForm(formData);

  if (!parsed.success) {
    redirect(settingsHref({
      message: "Yêu cầu xóa workspace không hợp lệ.",
      tab: "danger",
      type: "error",
      workspaceSlug: fallbackWorkspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(parsed.data.workspaceSlug);
  assertWorkspaceOwner({ membershipRole: context.membershipRole, workspaceSlug: context.workspace.slug }, "danger");

  if (!parsed.data.confirmChecked || parsed.data.confirmSlug !== context.workspace.slug) {
    redirect(settingsHref({
      message: "Bạn cần xác nhận slug và checkbox trước khi xóa workspace.",
      tab: "danger",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const supabase = await createServerSupabaseClient();

  if (context.workspace.logo_path) {
    await supabase.storage.from(WORKSPACE_LOGO_BUCKET).remove([context.workspace.logo_path]);
  }

  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", context.workspace.id);

  if (error) {
    redirect(settingsHref({
      message: error.message,
      tab: "danger",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  revalidateWorkspaceSurfaces();
  redirect(dashboardHref({
    message: "Đã xóa workspace thành công.",
    type: "success",
  }));
}
