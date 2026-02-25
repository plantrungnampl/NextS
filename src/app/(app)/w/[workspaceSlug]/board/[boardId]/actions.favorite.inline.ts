"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { APP_ROUTES } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { boardRoute, resolveBoardAccess } from "./actions.shared";

const toggleBoardFavoriteSchema = z.object({
  boardId: z.string().uuid(),
  nextFavorite: z.boolean(),
  workspaceSlug: z.string().trim().min(2).max(120),
});

export type ToggleBoardFavoriteResult = {
  error?: string;
  isFavorite: boolean;
  ok: boolean;
};

export async function toggleBoardFavoriteInline(input: {
  boardId: string;
  nextFavorite: boolean;
  workspaceSlug: string;
}): Promise<ToggleBoardFavoriteResult> {
  const parsed = toggleBoardFavoriteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid favorite payload.",
      isFavorite: false,
      ok: false,
    };
  }

  const { boardId, nextFavorite, workspaceSlug } = parsed.data;

  try {
    const access = await resolveBoardAccess(workspaceSlug, boardId, {
      requiredPermission: "read",
    });
    const supabase = await createServerSupabaseClient();

    if (nextFavorite) {
      const { error } = await supabase
        .from("board_favorites")
        .upsert(
          {
            board_id: boardId,
            user_id: access.userId,
          },
          {
            ignoreDuplicates: true,
            onConflict: "board_id,user_id",
          },
        );

      if (error) {
        return {
          error: error.message,
          isFavorite: false,
          ok: false,
        };
      }
    } else {
      const { error } = await supabase
        .from("board_favorites")
        .delete()
        .eq("board_id", boardId)
        .eq("user_id", access.userId);

      if (error) {
        return {
          error: error.message,
          isFavorite: true,
          ok: false,
        };
      }
    }

    revalidatePath(boardRoute(workspaceSlug, boardId));
    revalidatePath(APP_ROUTES.workspace.index);

    return {
      isFavorite: nextFavorite,
      ok: true,
    };
  } catch (error) {
    const message = resolveInlineActionErrorMessage(error, "Could not update board favorite.");

    return {
      error: message,
      isFavorite: !nextFavorite,
      ok: false,
    };
  }
}
