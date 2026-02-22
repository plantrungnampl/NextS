"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

import { boardRoute, logBoardActivity, resolveBoardAccess } from "./actions.shared";
import {
  assertAdminRole,
  cardLabelSchema,
  createLabelForCardSchema,
  createLabelSchema,
  deleteLabelSchema,
  ensureActiveCard,
  ensureLabelBelongsWorkspace,
  parseSchemaOrRedirect,
  redirectBoardError,
  revalidateBoardPath,
  updateLabelSchema,
} from "./actions.card-richness.shared";

export async function createWorkspaceLabel(formData: FormData) {
  const input = parseSchemaOrRedirect(createLabelSchema, {
    boardId: formData.get("boardId"),
    color: formData.get("color"),
    name: formData.get("name"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId);
  assertAdminRole(access.role, input.workspaceSlug, input.boardId);
  const supabase = await createServerSupabaseClient();

  const { data: label, error } = await supabase
    .from("labels")
    .insert({
      color: input.color,
      created_by: access.userId,
      name: input.name,
      workspace_id: access.workspaceId,
    })
    .select("id")
    .single();

  if (!label || error) {
    redirectBoardError(input.workspaceSlug, input.boardId, "Failed to create label.", error);
  }

  await logBoardActivity({
    action: "label.create",
    boardId: input.boardId,
    entityId: label.id,
    entityType: "label",
    metadata: { color: input.color, name: input.name },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function createWorkspaceLabelAndAttach(formData: FormData) {
  const input = parseSchemaOrRedirect(createLabelForCardSchema, {
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    color: formData.get("color"),
    name: formData.get("name"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId);
  assertAdminRole(access.role, input.workspaceSlug, input.boardId);
  const supabase = await createServerSupabaseClient();
  await ensureActiveCard(supabase, input.workspaceSlug, input.boardId, input.cardId);

  const { data: label, error: createError } = await supabase
    .from("labels")
    .insert({
      color: input.color,
      created_by: access.userId,
      name: input.name,
      workspace_id: access.workspaceId,
    })
    .select("id")
    .single();
  if (!label || createError) {
    redirectBoardError(input.workspaceSlug, input.boardId, "Failed to create label.", createError);
  }

  const { error: attachError } = await supabase
    .from("card_labels")
    .insert({
      card_id: input.cardId,
      label_id: label.id,
    });
  if (attachError) {
    await supabase
      .from("labels")
      .delete()
      .eq("id", label.id)
      .eq("workspace_id", access.workspaceId);
    redirectBoardError(input.workspaceSlug, input.boardId, "Failed to add label to card.", attachError);
  }

  await logBoardActivity({
    action: "label.create",
    boardId: input.boardId,
    entityId: label.id,
    entityType: "label",
    metadata: { color: input.color, name: input.name },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  await logBoardActivity({
    action: "card.label.add",
    boardId: input.boardId,
    entityId: input.cardId,
    entityType: "card",
    metadata: { labelId: label.id },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function updateWorkspaceLabel(formData: FormData) {
  const input = parseSchemaOrRedirect(updateLabelSchema, {
    boardId: formData.get("boardId"),
    color: formData.get("color"),
    labelId: formData.get("labelId"),
    name: formData.get("name"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId);
  assertAdminRole(access.role, input.workspaceSlug, input.boardId);
  const supabase = await createServerSupabaseClient();
  await ensureLabelBelongsWorkspace(
    supabase,
    input.workspaceSlug,
    input.boardId,
    access.workspaceId,
    input.labelId,
  );

  const { error } = await supabase
    .from("labels")
    .update({
      color: input.color,
      name: input.name,
    })
    .eq("id", input.labelId)
    .eq("workspace_id", access.workspaceId);

  if (error) {
    redirectBoardError(input.workspaceSlug, input.boardId, "Failed to update label.", error);
  }

  await logBoardActivity({
    action: "label.update",
    boardId: input.boardId,
    entityId: input.labelId,
    entityType: "label",
    metadata: { color: input.color, name: input.name },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function deleteWorkspaceLabel(formData: FormData) {
  const input = parseSchemaOrRedirect(deleteLabelSchema, {
    boardId: formData.get("boardId"),
    labelId: formData.get("labelId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId);
  assertAdminRole(access.role, input.workspaceSlug, input.boardId);
  const supabase = await createServerSupabaseClient();
  await ensureLabelBelongsWorkspace(
    supabase,
    input.workspaceSlug,
    input.boardId,
    access.workspaceId,
    input.labelId,
  );

  const { error } = await supabase
    .from("labels")
    .delete()
    .eq("id", input.labelId)
    .eq("workspace_id", access.workspaceId);

  if (error) {
    redirectBoardError(input.workspaceSlug, input.boardId, "Failed to delete label.", error);
  }

  await logBoardActivity({
    action: "label.delete",
    boardId: input.boardId,
    entityId: input.labelId,
    entityType: "label",
    metadata: {},
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function addCardLabel(formData: FormData) {
  const input = parseSchemaOrRedirect(cardLabelSchema, {
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    labelId: formData.get("labelId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId);
  const supabase = await createServerSupabaseClient();
  await ensureActiveCard(supabase, input.workspaceSlug, input.boardId, input.cardId);
  await ensureLabelBelongsWorkspace(
    supabase,
    input.workspaceSlug,
    input.boardId,
    access.workspaceId,
    input.labelId,
  );

  const { error } = await supabase
    .from("card_labels")
    .insert({
      card_id: input.cardId,
      label_id: input.labelId,
    });

  if (error && error.code !== "23505") {
    redirectBoardError(input.workspaceSlug, input.boardId, "Failed to add label to card.", error);
  }

  await logBoardActivity({
    action: "card.label.add",
    boardId: input.boardId,
    entityId: input.cardId,
    entityType: "card",
    metadata: { labelId: input.labelId },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function removeCardLabel(formData: FormData) {
  const input = parseSchemaOrRedirect(cardLabelSchema, {
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    labelId: formData.get("labelId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId);
  const supabase = await createServerSupabaseClient();
  await ensureActiveCard(supabase, input.workspaceSlug, input.boardId, input.cardId);

  const { error } = await supabase
    .from("card_labels")
    .delete()
    .eq("card_id", input.cardId)
    .eq("label_id", input.labelId);

  if (error) {
    redirectBoardError(input.workspaceSlug, input.boardId, "Failed to remove label from card.", error);
  }

  await logBoardActivity({
    action: "card.label.remove",
    boardId: input.boardId,
    entityId: input.cardId,
    entityType: "card",
    metadata: { labelId: input.labelId },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}
