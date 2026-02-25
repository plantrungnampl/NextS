"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase";

import { boardPathSchema } from "./actions.card-richness.shared";
import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { boardRoute, logBoardActivity, resolveBoardAccess } from "./actions.shared";
import type { CardCoverMode, CardCoverSize } from "./types";

const updateCardCoverSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  coverAttachmentId: z.string().uuid().nullable(),
  coverColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  coverColorblindFriendly: z.boolean().default(false),
  coverMode: z.enum(["none", "attachment", "color"]),
  coverSize: z.enum(["full", "header"]).default("full"),
});

type CardCoverPayload = z.infer<typeof updateCardCoverSchema>;

type CardCoverInlineResult =
  | {
    cover: {
      coverAttachmentId: string | null;
      coverColor: string | null;
      coverColorblindFriendly: boolean;
      coverMode: CardCoverMode;
      coverSize: CardCoverSize;
    };
    ok: true;
  }
  | { error: string; ok: false };

type PersistCoverResult =
  | {
    cover: {
      coverAttachmentId: string | null;
      coverColor: string | null;
      coverColorblindFriendly: boolean;
      coverMode: CardCoverMode;
      coverSize: CardCoverSize;
    };
    ok: true;
  }
  | { error: string; ok: false };

function parseUpdateCardCoverFormData(formData: FormData) {
  const rawCoverAttachmentId = formData.get("coverAttachmentId");
  const rawCoverColor = formData.get("coverColor");
  const rawCoverColorblindFriendly = formData.get("coverColorblindFriendly");
  const rawCoverMode = formData.get("coverMode");
  const rawCoverSize = formData.get("coverSize");

  return updateCardCoverSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    coverAttachmentId:
      typeof rawCoverAttachmentId === "string" && rawCoverAttachmentId.trim().length > 0
        ? rawCoverAttachmentId.trim()
        : null,
    coverColor:
      typeof rawCoverColor === "string" && rawCoverColor.trim().length > 0
        ? rawCoverColor.trim()
        : null,
    coverColorblindFriendly:
      typeof rawCoverColorblindFriendly === "string"
        ? rawCoverColorblindFriendly === "true"
        : false,
    coverMode: typeof rawCoverMode === "string" ? rawCoverMode : undefined,
    coverSize: typeof rawCoverSize === "string" ? rawCoverSize : undefined,
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

async function ensureAttachmentUsableAsCover(params: {
  attachmentId: string;
  cardId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}): Promise<{ error?: string; ok: boolean }> {
  const { data: attachment, error } = await params.supabase
    .from("attachments")
    .select("id, card_id, content_type, source_type")
    .eq("id", params.attachmentId)
    .maybeSingle();

  if (error || !attachment) {
    return {
      error: error?.message ?? "Attachment not found.",
      ok: false,
    };
  }

  const typedAttachment = attachment as {
    card_id: string;
    content_type: string | null;
    source_type: "file" | "url" | null;
  };
  if (typedAttachment.card_id !== params.cardId) {
    return {
      error: "Cover attachment must belong to the same card.",
      ok: false,
    };
  }

  const isImageAttachment = typedAttachment.source_type === "url"
    || typedAttachment.content_type?.startsWith("image/")
    || false;
  if (!isImageAttachment) {
    return {
      error: "Only image attachments can be used as card cover.",
      ok: false,
    };
  }

  return { ok: true };
}

async function persistCardCover(payload: CardCoverPayload): Promise<PersistCoverResult> {
  let nextCoverAttachmentId = payload.coverAttachmentId;
  let nextCoverColor = payload.coverColor;

  if (payload.coverMode === "none") {
    nextCoverAttachmentId = null;
    nextCoverColor = null;
  } else if (payload.coverMode === "attachment") {
    nextCoverColor = null;
    if (!nextCoverAttachmentId) {
      return { error: "Attachment cover requires an attachment id.", ok: false };
    }
  } else if (payload.coverMode === "color") {
    nextCoverAttachmentId = null;
    if (!nextCoverColor) {
      return { error: "Color cover requires a valid color.", ok: false };
    }
  }

  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  const supabase = await createServerSupabaseClient();

  if (payload.coverMode === "attachment" && nextCoverAttachmentId) {
    const attachmentValidationResult = await ensureAttachmentUsableAsCover({
      attachmentId: nextCoverAttachmentId,
      cardId: payload.cardId,
      supabase,
    });
    if (!attachmentValidationResult.ok) {
      return { error: attachmentValidationResult.error ?? "Invalid cover attachment.", ok: false };
    }
  }

  const { data: updatedCard, error } = await supabase
    .from("cards")
    .update({
      cover_attachment_id: nextCoverAttachmentId,
      cover_color: nextCoverColor,
      cover_colorblind_friendly: payload.coverColorblindFriendly,
      cover_mode: payload.coverMode,
      cover_size: payload.coverSize,
    })
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .select("cover_attachment_id, cover_color, cover_colorblind_friendly, cover_mode, cover_size")
    .maybeSingle();

  if (error || !updatedCard) {
    return {
      error: error?.message ?? "Failed to update card cover.",
      ok: false,
    };
  }

  const typedUpdatedCard = updatedCard as {
    cover_attachment_id: string | null;
    cover_color: string | null;
    cover_colorblind_friendly: boolean;
    cover_mode: CardCoverMode;
    cover_size: CardCoverSize;
  };

  await logBoardActivity({
    action: "cover.update",
    boardId: payload.boardId,
    entityId: payload.cardId,
    entityType: "card",
    metadata: {
      coverAttachmentId: typedUpdatedCard.cover_attachment_id,
      coverColor: typedUpdatedCard.cover_color,
      coverColorblindFriendly: typedUpdatedCard.cover_colorblind_friendly,
      coverMode: typedUpdatedCard.cover_mode,
      coverSize: typedUpdatedCard.cover_size,
    },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(payload.workspaceSlug, payload.boardId));

  return {
    cover: {
      coverAttachmentId: typedUpdatedCard.cover_attachment_id,
      coverColor: typedUpdatedCard.cover_color,
      coverColorblindFriendly: typedUpdatedCard.cover_colorblind_friendly,
      coverMode: typedUpdatedCard.cover_mode,
      coverSize: typedUpdatedCard.cover_size,
    },
    ok: true,
  };
}

export async function updateCardCoverInline(formData: FormData): Promise<CardCoverInlineResult> {
  const parsed = parseUpdateCardCoverFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid card cover payload.", ok: false };
  }

  try {
    return await persistCardCover(parsed.data);
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, "Failed to update card cover."),
      ok: false,
    };
  }
}
