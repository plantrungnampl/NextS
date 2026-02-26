"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

import {
  assertWorkspaceAdmin,
  removeMemberSchema,
  revalidateWorkspaceSurfaces,
  resolveMemberRecord,
  resolveWorkspaceActor,
  settingsHref,
  updateMemberRoleSchema,
  logWorkspaceActivity,
  type MemberRecord,
} from "./actions.shared";

function assertMemberManageable(params: {
  contextRole: "owner" | "admin" | "member";
  targetMember: MemberRecord;
  contextUserId: string;
  workspaceSlug: string;
}) {
  if (params.targetMember.user_id === params.contextUserId) {
    redirect(settingsHref({
      message: "Bạn không thể tự đổi role của chính mình tại đây.",
      tab: "members",
      type: "error",
      workspaceSlug: params.workspaceSlug,
    }));
  }

  if (params.targetMember.role === "owner") {
    redirect(settingsHref({
      message: "Không thể đổi role của owner trong tab Members.",
      tab: "members",
      type: "error",
      workspaceSlug: params.workspaceSlug,
    }));
  }

  if (params.contextRole === "admin" && params.targetMember.role !== "member") {
    redirect(settingsHref({
      message: "Admin chỉ có thể quản lý role của thành viên thường.",
      tab: "members",
      type: "error",
      workspaceSlug: params.workspaceSlug,
    }));
  }
}

export async function updateWorkspaceMemberRoleAction(formData: FormData) {
  const parsed = updateMemberRoleSchema.safeParse({
    memberUserId: formData.get("memberUserId"),
    nextRole: formData.get("nextRole"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const fallbackWorkspaceSlug = typeof formData.get("workspaceSlug") === "string"
    ? String(formData.get("workspaceSlug"))
    : "";

  if (!parsed.success) {
    redirect(settingsHref({
      message: "Yêu cầu cập nhật role không hợp lệ.",
      tab: "members",
      type: "error",
      workspaceSlug: fallbackWorkspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(parsed.data.workspaceSlug);
  assertWorkspaceAdmin({ membershipRole: context.membershipRole, workspaceSlug: context.workspace.slug }, "members");

  let targetMember: MemberRecord;
  try {
    targetMember = await resolveMemberRecord({
      memberUserId: parsed.data.memberUserId,
      workspaceId: context.workspace.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tìm thấy thành viên.";
    redirect(settingsHref({
      message,
      tab: "members",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  assertMemberManageable({
    contextRole: context.membershipRole,
    targetMember,
    contextUserId: context.userId,
    workspaceSlug: context.workspace.slug,
  });

  if (targetMember.role === parsed.data.nextRole) {
    redirect(settingsHref({
      message: "Role thành viên không thay đổi.",
      tab: "members",
      type: "success",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ role: parsed.data.nextRole })
    .eq("workspace_id", context.workspace.id)
    .eq("user_id", parsed.data.memberUserId);

  if (error) {
    redirect(settingsHref({
      message: error.message,
      tab: "members",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  await logWorkspaceActivity({
    action: "workspace.member.role.updated",
    metadata: {
      memberUserId: parsed.data.memberUserId,
      nextRole: parsed.data.nextRole,
      previousRole: targetMember.role,
    },
    userId: context.userId,
    workspaceId: context.workspace.id,
  });

  revalidateWorkspaceSurfaces();
  redirect(settingsHref({
    message: "Đã cập nhật role thành viên.",
    tab: "members",
    type: "success",
    workspaceSlug: context.workspace.slug,
  }));
}

function assertMemberRemovable(params: {
  contextRole: "owner" | "admin" | "member";
  targetMember: MemberRecord;
  contextUserId: string;
  workspaceSlug: string;
}) {
  if (params.targetMember.user_id === params.contextUserId) {
    redirect(settingsHref({
      message: "Không thể tự xóa chính mình ở tab Members. Hãy dùng Leave workspace.",
      tab: "members",
      type: "error",
      workspaceSlug: params.workspaceSlug,
    }));
  }

  if (params.targetMember.role === "owner") {
    redirect(settingsHref({
      message: "Không thể xóa owner. Hãy transfer ownership trước.",
      tab: "members",
      type: "error",
      workspaceSlug: params.workspaceSlug,
    }));
  }

  if (params.contextRole === "admin" && params.targetMember.role !== "member") {
    redirect(settingsHref({
      message: "Admin chỉ có thể xóa thành viên thường.",
      tab: "members",
      type: "error",
      workspaceSlug: params.workspaceSlug,
    }));
  }
}

export async function removeWorkspaceMemberAction(formData: FormData) {
  const parsed = removeMemberSchema.safeParse({
    memberUserId: formData.get("memberUserId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const fallbackWorkspaceSlug = typeof formData.get("workspaceSlug") === "string"
    ? String(formData.get("workspaceSlug"))
    : "";

  if (!parsed.success) {
    redirect(settingsHref({
      message: "Yêu cầu xóa thành viên không hợp lệ.",
      tab: "members",
      type: "error",
      workspaceSlug: fallbackWorkspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(parsed.data.workspaceSlug);
  assertWorkspaceAdmin({ membershipRole: context.membershipRole, workspaceSlug: context.workspace.slug }, "members");

  let targetMember: MemberRecord;
  try {
    targetMember = await resolveMemberRecord({
      memberUserId: parsed.data.memberUserId,
      workspaceId: context.workspace.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tìm thấy thành viên.";
    redirect(settingsHref({
      message,
      tab: "members",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  assertMemberRemovable({
    contextRole: context.membershipRole,
    targetMember,
    contextUserId: context.userId,
    workspaceSlug: context.workspace.slug,
  });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", context.workspace.id)
    .eq("user_id", parsed.data.memberUserId);

  if (error) {
    redirect(settingsHref({
      message: error.message,
      tab: "members",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  await logWorkspaceActivity({
    action: "workspace.member.removed",
    metadata: {
      memberUserId: parsed.data.memberUserId,
      removedRole: targetMember.role,
    },
    userId: context.userId,
    workspaceId: context.workspace.id,
  });

  revalidateWorkspaceSurfaces();
  redirect(settingsHref({
    message: "Đã xóa thành viên khỏi workspace.",
    tab: "members",
    type: "success",
    workspaceSlug: context.workspace.slug,
  }));
}
