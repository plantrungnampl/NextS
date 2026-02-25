"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import {
  assertCanManageWorkspaceLabels,
  boardPathSchema,
  cardLabelSchema,
  createLabelSchema,
  deleteLabelSchema,
  ensureLabelBelongsWorkspace,
  revalidateBoardPath,
  updateLabelSchema,
} from "./actions.card-richness.shared";
import { logBoardActivity, resolveBoardAccess } from "./actions.shared";
import { DEFAULT_LABEL_PRESETS } from "./label-presets";

type CardLabelInlineMutationResult =
  | { ok: true }
  | { error: string; ok: false };

type CreateWorkspaceLabelInlineResult =
  | { ok: true; label: { color: string; id: string; name: string } }
  | { error: string; ok: false };
type UpdateWorkspaceLabelInlineResult =
  | { ok: true; label: { color: string; id: string; name: string } }
  | { error: string; ok: false };
type DeleteWorkspaceLabelInlineResult =
  | { ok: true }
  | { error: string; ok: false };

type EnsureDefaultWorkspaceLabelsResult =
  | { ok: true; labels: Array<{ color: string; id: string; name: string }> }
  | { error: string; ok: false };

const createLabelInlineSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  name: z.string().max(50).optional(),
});

function parseCreateWorkspaceLabelPayload(formData: FormData) {
  return createLabelSchema.safeParse({
    boardId: formData.get("boardId"),
    color: formData.get("color"),
    name: formData.get("name"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

function parseUpdateWorkspaceLabelPayload(formData: FormData) {
  return updateLabelSchema.safeParse({
    boardId: formData.get("boardId"),
    color: formData.get("color"),
    labelId: formData.get("labelId"),
    name: formData.get("name"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

function parseDeleteWorkspaceLabelPayload(formData: FormData) {
  return deleteLabelSchema.safeParse({
    boardId: formData.get("boardId"),
    labelId: formData.get("labelId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

function parseCardLabelPayload(formData: FormData) {
  return cardLabelSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    labelId: formData.get("labelId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

async function ensureCardAndLabelExist(input: {
  boardId: string;
  cardId: string;
  labelId: string;
  workspaceId: string;
}) {
  const supabase = await createServerSupabaseClient();
  const [{ data: card, error: cardError }, { data: label, error: labelError }] = await Promise.all([
    supabase
      .from("cards")
      .select("id")
      .eq("id", input.cardId)
      .eq("board_id", input.boardId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("labels")
      .select("id")
      .eq("id", input.labelId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle(),
  ]);

  if (cardError || !card) {
    return { error: cardError?.message ?? "Card not found.", ok: false as const, supabase: null };
  }

  if (labelError || !label) {
    return { error: labelError?.message ?? "Label not found.", ok: false as const, supabase: null };
  }

  return { ok: true as const, supabase };
}

export async function addCardLabelInline(
  formData: FormData,
): Promise<CardLabelInlineMutationResult> {
  const parsed = parseCardLabelPayload(formData);
  if (!parsed.success) {
    return { error: "Invalid label payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const guardResult = await ensureCardAndLabelExist({
      boardId: parsed.data.boardId,
      cardId: parsed.data.cardId,
      labelId: parsed.data.labelId,
      workspaceId: access.workspaceId,
    });
    if (!guardResult.ok || !guardResult.supabase) {
      return { error: guardResult.error, ok: false };
    }

    const { error } = await guardResult.supabase
      .from("card_labels")
      .insert({
        card_id: parsed.data.cardId,
        label_id: parsed.data.labelId,
      });
    if (error && error.code !== "23505") {
      return { error: error.message, ok: false };
    }

    await logBoardActivity({
      action: "card.label.add",
      boardId: parsed.data.boardId,
      entityId: parsed.data.cardId,
      entityType: "card",
      metadata: { labelId: parsed.data.labelId },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return { ok: true };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to add label to card."), ok: false };
  }
}

export async function removeCardLabelInline(
  formData: FormData,
): Promise<CardLabelInlineMutationResult> {
  const parsed = parseCardLabelPayload(formData);
  if (!parsed.success) {
    return { error: "Invalid label payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const guardResult = await ensureCardAndLabelExist({
      boardId: parsed.data.boardId,
      cardId: parsed.data.cardId,
      labelId: parsed.data.labelId,
      workspaceId: access.workspaceId,
    });
    if (!guardResult.ok || !guardResult.supabase) {
      return { error: guardResult.error, ok: false };
    }

    const { error } = await guardResult.supabase
      .from("card_labels")
      .delete()
      .eq("card_id", parsed.data.cardId)
      .eq("label_id", parsed.data.labelId);
    if (error) {
      return { error: error.message, ok: false };
    }

    await logBoardActivity({
      action: "card.label.remove",
      boardId: parsed.data.boardId,
      entityId: parsed.data.cardId,
      entityType: "card",
      metadata: { labelId: parsed.data.labelId },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return { ok: true };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to remove label from card."), ok: false };
  }
}

export async function createWorkspaceLabelAndAttachInline(
  formData: FormData,
): Promise<CreateWorkspaceLabelInlineResult> {
  const parsed = createLabelInlineSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    color: formData.get("color"),
    name: formData.get("name"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    return { error: "Invalid label payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    assertCanManageWorkspaceLabels(access, parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id")
      .eq("id", parsed.data.cardId)
      .eq("board_id", parsed.data.boardId)
      .is("archived_at", null)
      .maybeSingle();
    if (cardError || !card) {
      return { error: cardError?.message ?? "Card not found.", ok: false };
    }

    const normalizedName = (parsed.data.name ?? "").trim().slice(0, 50);
    const { data: label, error: createError } = await supabase
      .from("labels")
      .insert({
        color: parsed.data.color,
        created_by: access.userId,
        name: normalizedName,
        workspace_id: access.workspaceId,
      })
      .select("id, color, name")
      .single();
    if (!label || createError) {
      return { error: createError?.message ?? "Failed to create label.", ok: false };
    }

    const { error: attachError } = await supabase
      .from("card_labels")
      .insert({
        card_id: parsed.data.cardId,
        label_id: label.id,
      });
    if (attachError) {
      await supabase
        .from("labels")
        .delete()
        .eq("id", label.id)
        .eq("workspace_id", access.workspaceId);
      return { error: attachError.message, ok: false };
    }

    await logBoardActivity({
      action: "label.create",
      boardId: parsed.data.boardId,
      entityId: label.id,
      entityType: "label",
      metadata: { color: label.color, name: label.name },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });
    await logBoardActivity({
      action: "card.label.add",
      boardId: parsed.data.boardId,
      entityId: parsed.data.cardId,
      entityType: "card",
      metadata: { labelId: label.id },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return {
      ok: true,
      label: {
        color: label.color,
        id: label.id,
        name: label.name ?? "",
      },
    };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to create label."), ok: false };
  }
}

export async function createWorkspaceLabelInline(
  formData: FormData,
): Promise<CreateWorkspaceLabelInlineResult> {
  const parsed = parseCreateWorkspaceLabelPayload(formData);
  if (!parsed.success) {
    return { error: "Invalid label payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    assertCanManageWorkspaceLabels(access, parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    const { data: label, error } = await supabase
      .from("labels")
      .insert({
        color: parsed.data.color,
        created_by: access.userId,
        name: parsed.data.name,
        workspace_id: access.workspaceId,
      })
      .select("id, color, name")
      .single();

    if (!label || error) {
      return { error: error?.message ?? "Failed to create label.", ok: false };
    }

    await logBoardActivity({
      action: "label.create",
      boardId: parsed.data.boardId,
      entityId: label.id,
      entityType: "label",
      metadata: { color: label.color, name: label.name },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return {
      ok: true,
      label: {
        color: label.color,
        id: label.id,
        name: label.name ?? "",
      },
    };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to create label."), ok: false };
  }
}

export async function updateWorkspaceLabelInline(
  formData: FormData,
): Promise<UpdateWorkspaceLabelInlineResult> {
  const parsed = parseUpdateWorkspaceLabelPayload(formData);
  if (!parsed.success) {
    return { error: "Invalid label payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    assertCanManageWorkspaceLabels(access, parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    await ensureLabelBelongsWorkspace(
      supabase,
      parsed.data.workspaceSlug,
      parsed.data.boardId,
      access.workspaceId,
      parsed.data.labelId,
    );

    const { data: label, error } = await supabase
      .from("labels")
      .update({
        color: parsed.data.color,
        name: parsed.data.name,
      })
      .eq("id", parsed.data.labelId)
      .eq("workspace_id", access.workspaceId)
      .select("id, color, name")
      .maybeSingle();

    if (!label || error) {
      return { error: error?.message ?? "Failed to update label.", ok: false };
    }

    await logBoardActivity({
      action: "label.update",
      boardId: parsed.data.boardId,
      entityId: parsed.data.labelId,
      entityType: "label",
      metadata: { color: parsed.data.color, name: parsed.data.name },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return {
      ok: true,
      label: {
        color: label.color,
        id: label.id,
        name: label.name ?? "",
      },
    };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to update label."), ok: false };
  }
}

export async function deleteWorkspaceLabelInline(
  formData: FormData,
): Promise<DeleteWorkspaceLabelInlineResult> {
  const parsed = parseDeleteWorkspaceLabelPayload(formData);
  if (!parsed.success) {
    return { error: "Invalid label payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    assertCanManageWorkspaceLabels(access, parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    await ensureLabelBelongsWorkspace(
      supabase,
      parsed.data.workspaceSlug,
      parsed.data.boardId,
      access.workspaceId,
      parsed.data.labelId,
    );

    const { error } = await supabase
      .from("labels")
      .delete()
      .eq("id", parsed.data.labelId)
      .eq("workspace_id", access.workspaceId);
    if (error) {
      return { error: error.message, ok: false };
    }

    await logBoardActivity({
      action: "label.delete",
      boardId: parsed.data.boardId,
      entityId: parsed.data.labelId,
      entityType: "label",
      metadata: {},
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return { ok: true };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to delete label."), ok: false };
  }
}

export async function ensureDefaultWorkspaceLabelsInline(
  formData: FormData,
): Promise<EnsureDefaultWorkspaceLabelsResult> {
  const parsed = boardPathSchema.safeParse({
    boardId: formData.get("boardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    return { error: "Invalid workspace payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    assertCanManageWorkspaceLabels(access, parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    const { data: existingLabels, error: existingLabelsError } = await supabase
      .from("labels")
      .select("id, color, name")
      .eq("workspace_id", access.workspaceId)
      .order("created_at", { ascending: true });
    if (existingLabelsError) {
      return { error: existingLabelsError.message, ok: false };
    }

    const typedExistingLabels = (existingLabels ?? []) as Array<{ color: string; id: string; name: string | null }>;
    const existingColors = new Set(typedExistingLabels.map((label) => label.color.toLowerCase()));
    const missingPresets = DEFAULT_LABEL_PRESETS.filter((preset) => !existingColors.has(preset.color.toLowerCase()));
    let insertedLabels: Array<{ color: string; id: string; name: string | null }> = [];
    if (missingPresets.length > 0) {
      const { data, error: insertError } = await supabase
        .from("labels")
        .insert(
          missingPresets.map((preset) => ({
            color: preset.color,
            created_by: access.userId,
            name: preset.name,
            workspace_id: access.workspaceId,
          })),
        )
        .select("id, color, name");
      if (insertError) {
        return { error: insertError.message, ok: false };
      }
      insertedLabels = (data ?? []) as Array<{ color: string; id: string; name: string | null }>;
    }

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return {
      ok: true,
      labels: [...typedExistingLabels, ...insertedLabels].map((label) => ({
        color: label.color,
        id: label.id,
        name: label.name ?? "",
      })),
    };
  } catch (error) {
    return { error: resolveInlineActionErrorMessage(error, "Failed to initialize default labels."), ok: false };
  }
}
