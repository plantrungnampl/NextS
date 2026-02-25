"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { APP_ROUTES, sanitizeUserText } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { boardRoute, logBoardActivity, resolveBoardAccess } from "./actions.shared";
import type { BoardPermissionLevel, BoardSettings } from "./types";

const boardPathSchema = z.object({
  boardId: z.string().uuid(),
  workspaceSlug: z.string().trim().min(2).max(120),
});

const renameBoardInlineSchema = boardPathSchema.extend({
  name: z.string().trim().min(1).max(160),
});

const boardPermissionLevelSchema = z.enum(["admins", "members"]);

const boardSettingsPatchSchema = z
  .object({
    commentPermission: boardPermissionLevelSchema.optional(),
    editPermission: boardPermissionLevelSchema.optional(),
    memberManagePermission: boardPermissionLevelSchema.optional(),
    showCardCoverOnFront: z.boolean().optional(),
    showCompleteStatusOnFront: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (Object.values(value).some((entry) => entry !== undefined)) {
      return;
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one settings field is required.",
    });
  });

const updateBoardSettingsSchema = boardPathSchema.extend({
  patch: boardSettingsPatchSchema,
});

type RenameBoardInlineResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

type ArchiveBoardInlineResult = { ok: true } | { ok: false; error: string };

type UpdateBoardSettingsInlineResult =
  | { ok: true; settings: BoardSettings }
  | { ok: false; error: string };

type BoardSettingsRow = {
  comment_permission: BoardPermissionLevel;
  edit_permission: BoardPermissionLevel;
  member_manage_permission: BoardPermissionLevel;
  show_card_cover_on_front: boolean;
  show_complete_status_on_front: boolean;
};

type BoardSettingsPatchInput = z.infer<typeof boardSettingsPatchSchema>;
type SupabaseErrorLike = {
  code?: string;
  message: string;
};

function nowIsoString(): string {
  return new Date().toISOString();
}

function isMissingBoardSettingsSchema(error: SupabaseErrorLike | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "42703") {
    return true;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes("edit_permission")
    || normalizedMessage.includes("comment_permission")
    || normalizedMessage.includes("member_manage_permission")
    || normalizedMessage.includes("show_complete_status_on_front")
    || normalizedMessage.includes("show_card_cover_on_front")
  );
}

function toBoardSettings(row: BoardSettingsRow): BoardSettings {
  return {
    commentPermission: row.comment_permission,
    editPermission: row.edit_permission,
    memberManagePermission: row.member_manage_permission,
    showCardCoverOnFront: row.show_card_cover_on_front,
    showCompleteStatusOnFront: row.show_complete_status_on_front,
  };
}

function toBoardSettingsDbPatch(patch: BoardSettingsPatchInput): Partial<BoardSettingsRow> {
  const updatePayload: Partial<BoardSettingsRow> = {};
  if (patch.commentPermission !== undefined) {
    updatePayload.comment_permission = patch.commentPermission;
  }
  if (patch.editPermission !== undefined) {
    updatePayload.edit_permission = patch.editPermission;
  }
  if (patch.memberManagePermission !== undefined) {
    updatePayload.member_manage_permission = patch.memberManagePermission;
  }
  if (patch.showCardCoverOnFront !== undefined) {
    updatePayload.show_card_cover_on_front = patch.showCardCoverOnFront;
  }
  if (patch.showCompleteStatusOnFront !== undefined) {
    updatePayload.show_complete_status_on_front = patch.showCompleteStatusOnFront;
  }

  return updatePayload;
}

export async function renameBoardInline(input: {
  boardId: string;
  name: string;
  workspaceSlug: string;
}): Promise<RenameBoardInlineResult> {
  const parsed = renameBoardInlineSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid board payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId, {
      requiredPermission: "write",
    });
    const sanitizedName = sanitizeUserText(parsed.data.name);

    if (sanitizedName.length < 1) {
      return { error: "Board name is required.", ok: false };
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("boards")
      .update({ name: sanitizedName })
      .eq("id", parsed.data.boardId)
      .eq("workspace_id", access.workspaceId)
      .is("archived_at", null);

    if (error) {
      return { error: error.message, ok: false };
    }

    await logBoardActivity({
      action: "rename",
      boardId: parsed.data.boardId,
      entityId: parsed.data.boardId,
      entityType: "board",
      metadata: { name: sanitizedName },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));

    return { name: sanitizedName, ok: true };
  } catch (error) {
    const message = resolveInlineActionErrorMessage(error, "Could not rename board.");
    return { error: message, ok: false };
  }
}

export async function archiveBoardInline(input: {
  boardId: string;
  workspaceSlug: string;
}): Promise<ArchiveBoardInlineResult> {
  const parsed = boardPathSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid board payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId, {
      requiredPermission: "write",
    });
    const supabase = await createServerSupabaseClient();
    const { data: archivedBoard, error } = await supabase
      .from("boards")
      .update({ archived_at: nowIsoString() })
      .eq("id", parsed.data.boardId)
      .eq("workspace_id", access.workspaceId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      return { error: error.message, ok: false };
    }

    if (!archivedBoard) {
      return { error: "Board is already archived or inaccessible.", ok: false };
    }

    await logBoardActivity({
      action: "archive",
      boardId: parsed.data.boardId,
      entityId: parsed.data.boardId,
      entityType: "board",
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
    revalidatePath(APP_ROUTES.workspace.boardsBySlug(parsed.data.workspaceSlug));

    return { ok: true };
  } catch (error) {
    const message = resolveInlineActionErrorMessage(error, "Could not archive board.");
    return { error: message, ok: false };
  }
}

export async function updateBoardSettingsInline(input: {
  boardId: string;
  patch: BoardSettingsPatchInput;
  workspaceSlug: string;
}): Promise<UpdateBoardSettingsInlineResult> {
  const parsed = updateBoardSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid board settings payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId, {
      requiredPermission: "write",
    });

    if (!access.canManageSettings) {
      return { error: "Bạn không có quyền chỉnh cài đặt bảng.", ok: false };
    }

    const supabase = await createServerSupabaseClient();
    const updatePatch = toBoardSettingsDbPatch(parsed.data.patch);
    const changedSettings = parsed.data.patch;

    const { data: boardRow, error: boardError } = await supabase
      .from("boards")
      .update(updatePatch)
      .eq("id", parsed.data.boardId)
      .eq("workspace_id", access.workspaceId)
      .is("archived_at", null)
      .select(
        "edit_permission, comment_permission, member_manage_permission, show_complete_status_on_front, show_card_cover_on_front",
      )
      .maybeSingle();

    if (isMissingBoardSettingsSchema(boardError as SupabaseErrorLike | null)) {
      return {
        error:
          "Schema settings của board chưa được migrate trên database hiện tại. Hãy chạy migration `20260222120000_board_settings_permissions.sql`.",
        ok: false,
      };
    }

    if (boardError || !boardRow) {
      return { error: boardError?.message ?? "Board not found or inaccessible.", ok: false };
    }

    await logBoardActivity({
      action: "board.settings.updated",
      boardId: parsed.data.boardId,
      entityId: parsed.data.boardId,
      entityType: "board",
      metadata: {
        changes: changedSettings,
      },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    return {
      ok: true,
      settings: toBoardSettings(boardRow as BoardSettingsRow),
    };
  } catch (error) {
    const message = resolveInlineActionErrorMessage(error, "Could not update board settings.");
    return { error: message, ok: false };
  }
}
