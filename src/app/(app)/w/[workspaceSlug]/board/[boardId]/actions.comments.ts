"use server";

import { redirect } from "next/navigation";

import { sanitizeUserText } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { boardRoute, logBoardActivity, resolveBoardAccess } from "./actions.shared";
import {
  createCommentSchema,
  deleteCommentSchema,
  ensureActiveCard,
  ensureActiveComment,
  parseSchemaOrRedirect,
  redirectBoardError,
  revalidateBoardPath,
  updateCommentSchema,
} from "./actions.card-richness.shared";

const COMMENT_PERMISSION_ERROR = "Bạn không có quyền bình luận trên bảng này.";

async function logCommentActivity(payload: {
  action: string;
  boardId: string;
  commentId: string;
  metadata: Record<string, unknown>;
  userId: string;
  workspaceId: string;
}) {
  await logBoardActivity({
    action: payload.action,
    boardId: payload.boardId,
    entityId: payload.commentId,
    entityType: "comment",
    metadata: payload.metadata,
    userId: payload.userId,
    workspaceId: payload.workspaceId,
  });
}

async function canCommentBoard(args: {
  boardId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}): Promise<boolean> {
  const { data, error } = await args.supabase.rpc("can_comment_board", {
    target_board_id: args.boardId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data === true;
}

async function ensureCommentAccessOrRedirect(args: {
  boardId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  workspaceSlug: string;
}) {
  const hasCommentAccess = await canCommentBoard({
    boardId: args.boardId,
    supabase: args.supabase,
  });

  if (!hasCommentAccess) {
    redirectBoardError(args.workspaceSlug, args.boardId, COMMENT_PERMISSION_ERROR);
  }
}

type CommentInlineMutationResult =
  | { ok: true }
  | { error: string; ok: false };

async function ensureCommentAccessInline(args: {
  boardId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}): Promise<CommentInlineMutationResult> {
  try {
    const hasCommentAccess = await canCommentBoard({
      boardId: args.boardId,
      supabase: args.supabase,
    });

    if (!hasCommentAccess) {
      return { error: COMMENT_PERMISSION_ERROR, ok: false };
    }

    return { ok: true };
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, COMMENT_PERMISSION_ERROR),
      ok: false,
    };
  }
}

export async function createCardComment(formData: FormData) {
  const input = parseSchemaOrRedirect(createCommentSchema, {
    boardId: formData.get("boardId"),
    body: formData.get("body"),
    cardId: formData.get("cardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId, { requiredPermission: "read" });
  const sanitizedBody = sanitizeUserText(input.body);
  if (sanitizedBody.length < 1 || sanitizedBody.length > 5000) {
    redirectBoardError(input.workspaceSlug, input.boardId, "Comment body must be 1-5000 characters.");
  }

  const supabase = await createServerSupabaseClient();
  await ensureCommentAccessOrRedirect({
    boardId: input.boardId,
    supabase,
    workspaceSlug: input.workspaceSlug,
  });
  await ensureActiveCard(supabase, input.workspaceSlug, input.boardId, input.cardId);

  const { data: comment, error } = await supabase
    .from("card_comments")
    .insert({
      body: sanitizedBody,
      card_id: input.cardId,
      created_by: access.userId,
    })
    .select("id")
    .single();

  if (!comment || error) {
    redirectBoardError(input.workspaceSlug, input.boardId, "Failed to create comment.", error);
  }

  await logCommentActivity({
    action: "comment.create",
    boardId: input.boardId,
    commentId: comment.id,
    metadata: { cardId: input.cardId },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function updateCardComment(formData: FormData) {
  const input = parseSchemaOrRedirect(updateCommentSchema, {
    boardId: formData.get("boardId"),
    body: formData.get("body"),
    commentId: formData.get("commentId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId, { requiredPermission: "read" });
  const sanitizedBody = sanitizeUserText(input.body);
  if (sanitizedBody.length < 1 || sanitizedBody.length > 5000) {
    redirectBoardError(input.workspaceSlug, input.boardId, "Comment body must be 1-5000 characters.");
  }

  const supabase = await createServerSupabaseClient();
  await ensureCommentAccessOrRedirect({
    boardId: input.boardId,
    supabase,
    workspaceSlug: input.workspaceSlug,
  });
  await ensureActiveComment(supabase, input.workspaceSlug, input.boardId, input.commentId);

  const { error } = await supabase
    .from("card_comments")
    .update({ body: sanitizedBody })
    .eq("id", input.commentId);

  if (error) {
    redirectBoardError(input.workspaceSlug, input.boardId, "Failed to update comment.", error);
  }

  await logCommentActivity({
    action: "comment.update",
    boardId: input.boardId,
    commentId: input.commentId,
    metadata: {},
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function deleteCardComment(formData: FormData) {
  const input = parseSchemaOrRedirect(deleteCommentSchema, {
    boardId: formData.get("boardId"),
    commentId: formData.get("commentId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId, { requiredPermission: "read" });
  const supabase = await createServerSupabaseClient();
  await ensureCommentAccessOrRedirect({
    boardId: input.boardId,
    supabase,
    workspaceSlug: input.workspaceSlug,
  });
  await ensureActiveComment(supabase, input.workspaceSlug, input.boardId, input.commentId);

  const { error } = await supabase
    .from("card_comments")
    .delete()
    .eq("id", input.commentId);

  if (error) {
    redirectBoardError(input.workspaceSlug, input.boardId, "Failed to delete comment.", error);
  }

  await logCommentActivity({
    action: "comment.delete",
    boardId: input.boardId,
    commentId: input.commentId,
    metadata: {},
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function createCardCommentInline(
  formData: FormData,
): Promise<CommentInlineMutationResult> {
  const parsed = createCommentSchema.safeParse({
    boardId: formData.get("boardId"),
    body: formData.get("body"),
    cardId: formData.get("cardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    return { error: "Invalid comment payload.", ok: false };
  }

  const sanitizedBody = sanitizeUserText(parsed.data.body);
  if (sanitizedBody.length < 1 || sanitizedBody.length > 5000) {
    return { error: "Comment body must be 1-5000 characters.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId, { requiredPermission: "read" });
    const supabase = await createServerSupabaseClient();
    const permissionCheck = await ensureCommentAccessInline({
      boardId: parsed.data.boardId,
      supabase,
    });
    if (!permissionCheck.ok) {
      return permissionCheck;
    }

    await ensureActiveCard(supabase, parsed.data.workspaceSlug, parsed.data.boardId, parsed.data.cardId);

    const { data: comment, error } = await supabase
      .from("card_comments")
      .insert({
        body: sanitizedBody,
        card_id: parsed.data.cardId,
        created_by: access.userId,
      })
      .select("id")
      .single();
    if (!comment || error) {
      return {
        error: error?.message ?? "Failed to create comment.",
        ok: false,
      };
    }

    await logCommentActivity({
      action: "comment.create",
      boardId: parsed.data.boardId,
      commentId: comment.id,
      metadata: { cardId: parsed.data.cardId },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });
    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return { ok: true };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to create comment."), ok: false };
  }
}

export async function updateCardCommentInline(
  formData: FormData,
): Promise<CommentInlineMutationResult> {
  const parsed = updateCommentSchema.safeParse({
    boardId: formData.get("boardId"),
    body: formData.get("body"),
    commentId: formData.get("commentId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    return { error: "Invalid comment payload.", ok: false };
  }

  const sanitizedBody = sanitizeUserText(parsed.data.body);
  if (sanitizedBody.length < 1 || sanitizedBody.length > 5000) {
    return { error: "Comment body must be 1-5000 characters.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId, { requiredPermission: "read" });
    const supabase = await createServerSupabaseClient();
    const permissionCheck = await ensureCommentAccessInline({
      boardId: parsed.data.boardId,
      supabase,
    });
    if (!permissionCheck.ok) {
      return permissionCheck;
    }

    await ensureActiveComment(supabase, parsed.data.workspaceSlug, parsed.data.boardId, parsed.data.commentId);

    const { error } = await supabase
      .from("card_comments")
      .update({ body: sanitizedBody })
      .eq("id", parsed.data.commentId);
    if (error) {
      return { error: error.message, ok: false };
    }

    await logCommentActivity({
      action: "comment.update",
      boardId: parsed.data.boardId,
      commentId: parsed.data.commentId,
      metadata: {},
      userId: access.userId,
      workspaceId: access.workspaceId,
    });
    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return { ok: true };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to update comment."), ok: false };
  }
}

export async function deleteCardCommentInline(
  formData: FormData,
): Promise<CommentInlineMutationResult> {
  const parsed = deleteCommentSchema.safeParse({
    boardId: formData.get("boardId"),
    commentId: formData.get("commentId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    return { error: "Invalid comment payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId, { requiredPermission: "read" });
    const supabase = await createServerSupabaseClient();
    const permissionCheck = await ensureCommentAccessInline({
      boardId: parsed.data.boardId,
      supabase,
    });
    if (!permissionCheck.ok) {
      return permissionCheck;
    }

    await ensureActiveComment(supabase, parsed.data.workspaceSlug, parsed.data.boardId, parsed.data.commentId);

    const { error } = await supabase
      .from("card_comments")
      .delete()
      .eq("id", parsed.data.commentId);
    if (error) {
      return { error: error.message, ok: false };
    }

    await logCommentActivity({
      action: "comment.delete",
      boardId: parsed.data.boardId,
      commentId: parsed.data.commentId,
      metadata: {},
      userId: access.userId,
      workspaceId: access.workspaceId,
    });
    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return { ok: true };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to delete comment."), ok: false };
  }
}
