import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { APP_ROUTES } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { boardRoute, type BoardAccess, withBoardError } from "./actions.shared";
import type { WorkspaceRole } from "./types";

export const ATTACHMENT_BUCKET = "attachments";
export const ATTACHMENT_MAX_SIZE_BYTES = 15 * 1024 * 1024;
export const ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

export const boardPathSchema = z.object({
  boardId: z.uuid(),
  workspaceSlug: z.string().trim().min(3).max(64),
});

export const createCommentSchema = boardPathSchema.extend({
  body: z.string().trim().min(1).max(5000),
  cardId: z.uuid(),
});

export const updateCommentSchema = boardPathSchema.extend({
  body: z.string().trim().min(1).max(5000),
  commentId: z.string().uuid(),
});

export const deleteCommentSchema = boardPathSchema.extend({
  commentId: z.uuid(),
});

export const createLabelSchema = boardPathSchema.extend({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  name: z.string().trim().min(1).max(50),
});

export const createLabelForCardSchema = createLabelSchema.extend({
  cardId: z.uuid(),
});

export const updateLabelSchema = boardPathSchema.extend({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  labelId: z.string().uuid(),
  name: z.string().trim().min(1).max(50),
});

export const deleteLabelSchema = boardPathSchema.extend({
  labelId: z.uuid(),
});

export const cardLabelSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  labelId: z.uuid(),
});

export const assignMemberSchema = boardPathSchema.extend({
  cardId: z.uuid(),
  userId: z.uuid(),
});

export const deleteAttachmentSchema = boardPathSchema.extend({
  attachmentId: z.uuid(),
});

export const createChecklistItemSchema = boardPathSchema.extend({
  body: z.string().trim().min(1).max(500),
  checklistId: z.string().uuid(),
});

export const createChecklistSchema = boardPathSchema.extend({
  cardId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
});

export const updateChecklistSchema = boardPathSchema.extend({
  checklistId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
});

export const deleteChecklistSchema = boardPathSchema.extend({
  checklistId: z.string().uuid(),
});

export const reorderChecklistsSchema = boardPathSchema.extend({
  cardId: z.string().uuid(),
  orderedChecklistIds: z.array(z.string().uuid()).min(1).max(50),
});

export const updateChecklistItemSchema = boardPathSchema.extend({
  body: z.string().trim().min(1).max(500),
  checklistItemId: z.string().uuid(),
});

export const toggleChecklistItemSchema = boardPathSchema.extend({
  checklistItemId: z.string().uuid(),
  isDone: z.boolean(),
});

export const deleteChecklistItemSchema = boardPathSchema.extend({
  checklistItemId: z.string().uuid(),
});

export const reorderChecklistItemsSchema = boardPathSchema.extend({
  checklistId: z.string().uuid(),
  orderedItemIds: z.array(z.string().uuid()).min(1).max(200),
});

export const uploadAttachmentPathSchema = boardPathSchema.extend({
  cardId: z.string().uuid(),
});

const attachmentHttpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(4096);

export const addAttachmentUrlSchema = uploadAttachmentPathSchema.extend({
  displayText: z.string().trim().max(255).optional(),
  externalUrl: attachmentHttpUrlSchema,
});

export const recentAttachmentLinksSchema = boardPathSchema.extend({
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const refreshLegacyAttachmentTitlesSchema = uploadAttachmentPathSchema.extend({
  limit: z.coerce.number().int().min(1).max(5).default(5),
});

export type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export function parseSchemaOrRedirect<T>(schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  return parsed.data;
}

export function sanitizeFileName(fileName: string): string {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, 120) || "file";
}

export function assertAdminRole(role: WorkspaceRole, workspaceSlug: string, boardId: string): void {
  if (role === "owner" || role === "admin") {
    return;
  }

  redirect(withBoardError(workspaceSlug, boardId, "Only owner/admin can manage workspace labels."));
}

export function canManageWorkspaceLabels(access: Pick<BoardAccess, "isBoardCreator" | "role">): boolean {
  return access.isBoardCreator || access.role === "owner" || access.role === "admin";
}

export function assertCanManageWorkspaceLabels(
  access: Pick<BoardAccess, "isBoardCreator" | "role">,
  workspaceSlug: string,
  boardId: string,
): void {
  if (canManageWorkspaceLabels(access)) {
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[labels] denied workspace label management", {
      boardId,
      isBoardCreator: access.isBoardCreator,
      role: access.role,
      workspaceSlug,
    });
  }

  redirect(withBoardError(workspaceSlug, boardId, "Only owner/admin can manage workspace labels."));
}

export function revalidateBoardPath(workspaceSlug: string, boardId: string): void {
  revalidatePath(boardRoute(workspaceSlug, boardId));
}

export function redirectBoardError(
  workspaceSlug: string,
  boardId: string,
  fallback: string,
  error?: { message: string } | null,
): never {
  redirect(withBoardError(workspaceSlug, boardId, error?.message ?? fallback));
}

export async function ensureActiveCard(
  supabase: SupabaseServerClient,
  workspaceSlug: string,
  boardId: string,
  cardId: string,
): Promise<void> {
  const { data: card, error } = await supabase
    .from("cards")
    .select("id")
    .eq("id", cardId)
    .eq("board_id", boardId)
    .is("archived_at", null)
    .maybeSingle();

  if (!card || error) {
    redirectBoardError(workspaceSlug, boardId, "Card not found.", error);
  }
}

export async function ensureActiveComment(
  supabase: SupabaseServerClient,
  workspaceSlug: string,
  boardId: string,
  commentId: string,
): Promise<void> {
  const { data: comment, error } = await supabase
    .from("card_comments")
    .select("id, cards!inner(board_id)")
    .eq("id", commentId)
    .eq("cards.board_id", boardId)
    .maybeSingle();

  if (!comment || error) {
    redirectBoardError(workspaceSlug, boardId, "Comment not found.", error);
  }
}

export async function ensureActiveChecklistItem(
  supabase: SupabaseServerClient,
  workspaceSlug: string,
  boardId: string,
  checklistItemId: string,
): Promise<{ cardId: string; checklistId: string; id: string }> {
  const { data: checklistItem, error } = await supabase
    .from("card_checklist_items")
    .select("id, checklist_id")
    .eq("id", checklistItemId)
    .maybeSingle();

  if (!checklistItem || error) {
    redirectBoardError(workspaceSlug, boardId, "Checklist item not found.", error);
  }

  const checklist = await ensureActiveChecklist(
    supabase,
    workspaceSlug,
    boardId,
    checklistItem.checklist_id as string,
  );

  return {
    cardId: checklist.cardId,
    checklistId: checklistItem.checklist_id as string,
    id: checklistItem.id as string,
  };
}

export async function ensureActiveChecklist(
  supabase: SupabaseServerClient,
  workspaceSlug: string,
  boardId: string,
  checklistId: string,
): Promise<{ cardId: string; id: string }> {
  const { data: checklist, error } = await supabase
    .from("card_checklists")
    .select("id, card_id, cards!inner(board_id)")
    .eq("id", checklistId)
    .eq("cards.board_id", boardId)
    .maybeSingle();

  if (!checklist || error) {
    redirectBoardError(workspaceSlug, boardId, "Checklist not found.", error);
  }

  return {
    cardId: checklist.card_id as string,
    id: checklist.id as string,
  };
}

export async function ensureLabelBelongsWorkspace(
  supabase: SupabaseServerClient,
  workspaceSlug: string,
  boardId: string,
  workspaceId: string,
  labelId: string,
): Promise<void> {
  const { data: label, error } = await supabase
    .from("labels")
    .select("id")
    .eq("id", labelId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!label || error) {
    redirectBoardError(workspaceSlug, boardId, "Label not found.", error);
  }
}

export function assertAttachmentFile(
  fileEntry: FormDataEntryValue | null,
  workspaceSlug: string,
  boardId: string,
): File {
  if (!(fileEntry instanceof File)) {
    redirect(withBoardError(workspaceSlug, boardId, "Attachment file is required."));
  }

  const validationError = resolveAttachmentFileError(fileEntry);
  if (validationError) {
    redirect(withBoardError(workspaceSlug, boardId, validationError));
  }

  return fileEntry;
}

export function resolveAttachmentFileError(file: File): string | null {
  if (file.size <= 0) {
    return "Attachment file is empty.";
  }

  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return "Attachment must be 15MB or smaller.";
  }

  if (!ATTACHMENT_ALLOWED_MIME_TYPES.has(file.type)) {
    return "Unsupported attachment file type.";
  }

  return null;
}
