"use server";

import { redirect } from "next/navigation";

import { sanitizeNullableUserText, sanitizeUserText } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import {
  assertWorkspaceAdmin,
  baseWorkspaceSchema,
  enforceWorkspaceMutationRateLimit,
  logWorkspaceActivity,
  parseFile,
  revalidateWorkspaceSurfaces,
  resolveWorkspaceActor,
  sanitizeLogoFileName,
  settingsHref,
  slugifyWorkspace,
  updateWorkspaceCoreSchema,
  WORKSPACE_LOGO_BUCKET,
  WORKSPACE_LOGO_MAX_BYTES,
} from "./actions.shared";

export async function updateWorkspaceCoreAction(formData: FormData) {
  const parsed = updateWorkspaceCoreSchema.safeParse({
    description: formData.get("description"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const fallbackWorkspaceSlug = typeof formData.get("workspaceSlug") === "string"
    ? String(formData.get("workspaceSlug"))
    : "";

  if (!parsed.success) {
    redirect(settingsHref({
      message: "Dữ liệu cài đặt không hợp lệ.",
      tab: "general",
      type: "error",
      workspaceSlug: fallbackWorkspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(parsed.data.workspaceSlug);
  assertWorkspaceAdmin({ membershipRole: context.membershipRole, workspaceSlug: context.workspace.slug }, "general");

  await enforceWorkspaceMutationRateLimit({
    action: "update-core",
    userId: context.userId,
    workspaceId: context.workspace.id,
    workspaceSlug: context.workspace.slug,
  });

  const normalizedName = sanitizeUserText(parsed.data.name);
  const normalizedSlug = slugifyWorkspace(parsed.data.slug);
  const normalizedDescription = sanitizeNullableUserText(parsed.data.description ?? null);

  if (normalizedName.length < 3 || normalizedName.length > 120) {
    redirect(settingsHref({
      message: "Tên workspace phải từ 3 đến 120 ký tự.",
      tab: "general",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug) || normalizedSlug.length < 3 || normalizedSlug.length > 64) {
    redirect(settingsHref({
      message: "Slug không hợp lệ. Chỉ dùng chữ thường, số và dấu gạch ngang.",
      tab: "general",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("workspaces")
    .update({
      description: normalizedDescription,
      name: normalizedName,
      slug: normalizedSlug,
    })
    .eq("id", context.workspace.id);

  if (error) {
    if (error.code === "23505") {
      redirect(settingsHref({
        message: "Slug đã tồn tại. Hãy chọn slug khác.",
        tab: "general",
        type: "error",
        workspaceSlug: context.workspace.slug,
      }));
    }

    redirect(settingsHref({
      message: error.message,
      tab: "general",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  await logWorkspaceActivity({
    action: "workspace.settings.updated",
    metadata: {
      changedFields: ["name", "slug", "description"],
    },
    userId: context.userId,
    workspaceId: context.workspace.id,
  });

  revalidateWorkspaceSurfaces();
  redirect(settingsHref({
    message: "Đã cập nhật cài đặt workspace.",
    tab: "general",
    type: "success",
    workspaceSlug: normalizedSlug,
  }));
}

export async function uploadWorkspaceLogoAction(formData: FormData) {
  const workspaceSlug = typeof formData.get("workspaceSlug") === "string"
    ? String(formData.get("workspaceSlug"))
    : "";
  const file = parseFile(formData.get("logo"));

  if (!file) {
    redirect(settingsHref({
      message: "Vui lòng chọn file logo.",
      tab: "general",
      type: "error",
      workspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(workspaceSlug);
  assertWorkspaceAdmin({ membershipRole: context.membershipRole, workspaceSlug: context.workspace.slug }, "general");

  if (!file.type.startsWith("image/")) {
    redirect(settingsHref({
      message: "Logo phải là file ảnh.",
      tab: "general",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  if (file.size > WORKSPACE_LOGO_MAX_BYTES) {
    redirect(settingsHref({
      message: "Logo vượt quá 5MB.",
      tab: "general",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const safeName = sanitizeLogoFileName(file.name);
  const nextPath = `workspaces/${context.workspace.id}/logo/${crypto.randomUUID()}-${safeName}`;

  const supabase = await createServerSupabaseClient();
  const { error: uploadError } = await supabase.storage
    .from(WORKSPACE_LOGO_BUCKET)
    .upload(nextPath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    redirect(settingsHref({
      message: uploadError.message,
      tab: "general",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  const { error: updateError } = await supabase
    .from("workspaces")
    .update({ logo_path: nextPath })
    .eq("id", context.workspace.id);

  if (updateError) {
    await supabase.storage.from(WORKSPACE_LOGO_BUCKET).remove([nextPath]);
    redirect(settingsHref({
      message: updateError.message,
      tab: "general",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  if (context.workspace.logo_path && context.workspace.logo_path !== nextPath) {
    await supabase.storage.from(WORKSPACE_LOGO_BUCKET).remove([context.workspace.logo_path]);
  }

  await logWorkspaceActivity({
    action: "workspace.logo.updated",
    metadata: {
      logoPath: nextPath,
    },
    userId: context.userId,
    workspaceId: context.workspace.id,
  });

  revalidateWorkspaceSurfaces();
  redirect(settingsHref({
    message: "Đã cập nhật logo workspace.",
    tab: "general",
    type: "success",
    workspaceSlug: context.workspace.slug,
  }));
}

export async function removeWorkspaceLogoAction(formData: FormData) {
  const parsed = baseWorkspaceSchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const fallbackWorkspaceSlug = typeof formData.get("workspaceSlug") === "string"
    ? String(formData.get("workspaceSlug"))
    : "";

  if (!parsed.success) {
    redirect(settingsHref({
      message: "Workspace không hợp lệ.",
      tab: "general",
      type: "error",
      workspaceSlug: fallbackWorkspaceSlug,
    }));
  }

  const context = await resolveWorkspaceActor(parsed.data.workspaceSlug);
  assertWorkspaceAdmin({ membershipRole: context.membershipRole, workspaceSlug: context.workspace.slug }, "general");

  const supabase = await createServerSupabaseClient();
  const oldLogoPath = context.workspace.logo_path;

  const { error } = await supabase
    .from("workspaces")
    .update({ logo_path: null })
    .eq("id", context.workspace.id);

  if (error) {
    redirect(settingsHref({
      message: error.message,
      tab: "general",
      type: "error",
      workspaceSlug: context.workspace.slug,
    }));
  }

  if (oldLogoPath) {
    await supabase.storage.from(WORKSPACE_LOGO_BUCKET).remove([oldLogoPath]);
  }

  await logWorkspaceActivity({
    action: "workspace.logo.removed",
    userId: context.userId,
    workspaceId: context.workspace.id,
  });

  revalidateWorkspaceSurfaces();
  redirect(settingsHref({
    message: "Đã xóa logo workspace.",
    tab: "general",
    type: "success",
    workspaceSlug: context.workspace.slug,
  }));
}
