"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { boardRoute, logBoardActivity, resolveBoardAccess } from "./actions.shared";
import type { BoardVisibility } from "./types";

const updateBoardVisibilitySchema = z.object({
  boardId: z.string().uuid(),
  nextVisibility: z.enum(["private", "workspace", "public"]),
  workspaceSlug: z.string().trim().min(2).max(120),
});

export type UpdateBoardVisibilityInlineResult =
  | { ok: true; visibility: BoardVisibility }
  | { ok: false; error: string };

export async function updateBoardVisibilityInline(input: {
  boardId: string;
  nextVisibility: BoardVisibility;
  workspaceSlug: string;
}): Promise<UpdateBoardVisibilityInlineResult> {
  const parsed = updateBoardVisibilitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid visibility payload.",
      ok: false,
    };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId, {
      requiredPermission: "write",
    });
    if (!access.canManageSettings) {
      return {
        error: "Bạn không có quyền cập nhật khả năng hiển thị của bảng.",
        ok: false,
      };
    }
    const supabase = await createServerSupabaseClient();

    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("visibility")
      .eq("id", parsed.data.boardId)
      .eq("workspace_id", access.workspaceId)
      .is("archived_at", null)
      .maybeSingle();

    if (boardError || !board) {
      return {
        error: boardError?.message ?? "Board not found or inaccessible.",
        ok: false,
      };
    }

    const currentVisibility = (board as { visibility: BoardVisibility }).visibility;
    if (currentVisibility === parsed.data.nextVisibility) {
      return {
        ok: true,
        visibility: currentVisibility,
      };
    }

    const { error: updateError } = await supabase
      .from("boards")
      .update({ visibility: parsed.data.nextVisibility })
      .eq("id", parsed.data.boardId)
      .eq("workspace_id", access.workspaceId)
      .is("archived_at", null);

    if (updateError) {
      return {
        error: updateError.message,
        ok: false,
      };
    }

    await logBoardActivity({
      action: "board.visibility.updated",
      boardId: parsed.data.boardId,
      entityId: parsed.data.boardId,
      entityType: "board",
      metadata: {
        nextVisibility: parsed.data.nextVisibility,
        previousVisibility: currentVisibility,
      },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));

    return {
      ok: true,
      visibility: parsed.data.nextVisibility,
    };
  } catch (error) {
    const message = resolveInlineActionErrorMessage(error, "Could not update board visibility.");
    return {
      error: message,
      ok: false,
    };
  }
}
