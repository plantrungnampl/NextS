"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { boardRoute, logBoardActivity, resolveBoardAccess } from "./actions.shared";
import {
  assignMemberSchema,
  ensureActiveCard,
  parseSchemaOrRedirect,
  redirectBoardError,
  revalidateBoardPath,
} from "./actions.card-richness.shared";
type AssignMemberMutationResult =
  | { ok: true }
  | { error: string; ok: false };

function parseAssignMemberFormData(formData: FormData) {
  return assignMemberSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    userId: formData.get("userId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

async function persistAssignCardMember(input: {
  boardId: string;
  cardId: string;
  userId: string;
  workspaceSlug: string;
}): Promise<AssignMemberMutationResult> {
  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId);
  const supabase = await createServerSupabaseClient();
  await ensureActiveCard(supabase, input.workspaceSlug, input.boardId, input.cardId);

  const { data: member } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", access.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (!member) {
    return { error: "Assignee must be a workspace member.", ok: false };
  }

  const { error } = await supabase
    .from("card_assignees")
    .insert({
      card_id: input.cardId,
      user_id: input.userId,
    });

  if (error && error.code !== "23505") {
    return { error: error.message ?? "Failed to assign member.", ok: false };
  }

  await logBoardActivity({
    action: "card.assignee.add",
    boardId: input.boardId,
    entityId: input.cardId,
    entityType: "member",
    metadata: { userId: input.userId },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  return { ok: true };
}

async function persistUnassignCardMember(input: {
  boardId: string;
  cardId: string;
  userId: string;
  workspaceSlug: string;
}): Promise<AssignMemberMutationResult> {
  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId);
  const supabase = await createServerSupabaseClient();
  await ensureActiveCard(supabase, input.workspaceSlug, input.boardId, input.cardId);

  const { error } = await supabase
    .from("card_assignees")
    .delete()
    .eq("card_id", input.cardId)
    .eq("user_id", input.userId);

  if (error) {
    return { error: error.message ?? "Failed to unassign member.", ok: false };
  }

  await logBoardActivity({
    action: "card.assignee.remove",
    boardId: input.boardId,
    entityId: input.cardId,
    entityType: "member",
    metadata: { userId: input.userId },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  return { ok: true };
}

export async function assignCardMember(formData: FormData) {
  const input = parseSchemaOrRedirect(assignMemberSchema, {
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    userId: formData.get("userId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const result = await persistAssignCardMember(input);
  if (!result.ok) {
    redirectBoardError(input.workspaceSlug, input.boardId, result.error);
  }

  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function unassignCardMember(formData: FormData) {
  const input = parseSchemaOrRedirect(assignMemberSchema, {
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    userId: formData.get("userId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const result = await persistUnassignCardMember(input);
  if (!result.ok) {
    redirectBoardError(input.workspaceSlug, input.boardId, result.error);
  }

  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function assignCardMemberInline(
  formData: FormData,
): Promise<AssignMemberMutationResult> {
  const parsed = parseAssignMemberFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid assignee payload.", ok: false };
  }

  try {
    return await persistAssignCardMember(parsed.data);
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, "Failed to assign member."),
      ok: false,
    };
  }
}

export async function unassignCardMemberInline(
  formData: FormData,
): Promise<AssignMemberMutationResult> {
  const parsed = parseAssignMemberFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid assignee payload.", ok: false };
  }

  try {
    return await persistUnassignCardMember(parsed.data);
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, "Failed to unassign member."),
      ok: false,
    };
  }
}
