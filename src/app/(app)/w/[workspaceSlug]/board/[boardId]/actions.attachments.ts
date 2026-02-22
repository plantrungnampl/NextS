"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

import {
  boardRoute,
  logBoardActivity,
  resolveBoardAccess,
  withBoardError,
} from "./actions.shared";
import {
  assertAttachmentFile,
  ATTACHMENT_BUCKET,
  deleteAttachmentSchema,
  ensureActiveCard,
  parseSchemaOrRedirect,
  redirectBoardError,
  resolveAttachmentFileError,
  revalidateBoardPath,
  sanitizeFileName,
  uploadAttachmentPathSchema,
} from "./actions.card-richness.shared";

type AttachmentMutationResult =
  | {
    attachments?: InsertedAttachmentRow[];
    ok: true;
    uploadedCount?: number;
  }
  | { error: string; ok: false };

type InsertedAttachmentRow = {
  content_type: string | null;
  created_at: string;
  created_by: string;
  external_url: string | null;
  file_name: string;
  id: string;
  size_bytes: number;
  source_type: "file" | "url" | null;
  storage_path: string | null;
};

type AttachmentAccess = {
  role: "admin" | "member" | "owner" | "viewer";
  userId: string;
  workspaceId: string;
};

type AttachmentRow = {
  card_id: string;
  created_by: string;
  external_url: string | null;
  id: string;
  source_type: "file" | "url" | null;
  storage_path: string | null;
};

function toFiles(entries: FormDataEntryValue[]): File[] {
  return entries.filter((entry): entry is File => entry instanceof File);
}

function isManagerRole(role: AttachmentAccess["role"]): boolean {
  return role === "owner" || role === "admin";
}

function createStoragePath(params: {
  boardId: string;
  cardId: string;
  fileName: string;
  workspaceId: string;
}): { attachmentId: string; storagePath: string } {
  const attachmentId = crypto.randomUUID();
  const safeFileName = sanitizeFileName(params.fileName);
  const storagePath = `workspaces/${params.workspaceId}/boards/${params.boardId}/cards/${params.cardId}/${attachmentId}-${safeFileName}`;
  return { attachmentId, storagePath };
}

async function uploadSingleAttachment(params: {
  access: AttachmentAccess;
  boardId: string;
  cardId: string;
  file: File;
}): Promise<InsertedAttachmentRow> {
  const supabase = await createServerSupabaseClient();
  const { attachmentId, storagePath } = createStoragePath({
    boardId: params.boardId,
    cardId: params.cardId,
    fileName: params.file.name,
    workspaceId: params.access.workspaceId,
  });

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(storagePath, params.file, {
      contentType: params.file.type,
      upsert: false,
    });
  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload attachment file.");
  }

  const { data: attachment, error: insertError } = await supabase
    .from("attachments")
    .insert({
      card_id: params.cardId,
      content_type: params.file.type,
      created_by: params.access.userId,
      external_url: null,
      file_name: params.file.name,
      id: attachmentId,
      size_bytes: params.file.size,
      source_type: "file",
      storage_path: storagePath,
    })
    .select("id, file_name, content_type, size_bytes, created_by, created_at, source_type, external_url, storage_path")
    .single();

  if (!attachment || insertError) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
    throw new Error(insertError?.message || "Failed to register attachment.");
  }

  await logBoardActivity({
    action: "attachment.add",
    boardId: params.boardId,
    entityId: params.cardId,
    entityType: "card",
    metadata: { attachmentId: attachment.id, fileName: params.file.name },
    userId: params.access.userId,
    workspaceId: params.access.workspaceId,
  });

  return attachment as InsertedAttachmentRow;
}

async function loadAttachmentForDelete(params: {
  attachmentId: string;
  boardId: string;
  workspaceSlug: string;
}): Promise<AttachmentRow> {
  const supabase = await createServerSupabaseClient();
  const { data: attachment, error: attachmentError } = await supabase
    .from("attachments")
    .select("id, card_id, created_by, storage_path, source_type, external_url")
    .eq("id", params.attachmentId)
    .maybeSingle();

  if (!attachment || attachmentError) {
    redirectBoardError(params.workspaceSlug, params.boardId, "Attachment not found.", attachmentError);
  }

  return attachment as AttachmentRow;
}

function assertDeletePermission(params: {
  access: AttachmentAccess;
  attachment: AttachmentRow;
  boardId: string;
  workspaceSlug: string;
}) {
  if (params.attachment.created_by === params.access.userId || isManagerRole(params.access.role)) {
    return;
  }

  redirect(
    withBoardError(
      params.workspaceSlug,
      params.boardId,
      "Only creator/admin can delete attachment.",
    ),
  );
}

async function hasOtherStorageReferences(params: {
  attachmentId: string;
  storagePath: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("attachments")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", params.storagePath)
    .neq("id", params.attachmentId);
  if (error) {
    throw new Error(error.message || "Failed to verify attachment storage references.");
  }

  return (count ?? 0) > 0;
}

async function deleteAttachmentRecord(params: {
  access: AttachmentAccess;
  attachment: AttachmentRow;
  boardId: string;
  workspaceSlug: string;
}) {
  const supabase = await createServerSupabaseClient();
  const sourceType = params.attachment.source_type === "url" ? "url" : "file";

  if (sourceType === "file") {
    const storagePath = params.attachment.storage_path;
    if (!storagePath || storagePath.trim().length < 1) {
      throw new Error("Attachment file path is missing.");
    }

    const hasSharedReference = await hasOtherStorageReferences({
      attachmentId: params.attachment.id,
      storagePath,
    });
    if (!hasSharedReference) {
      const { error: removeFileError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([storagePath]);
      if (removeFileError) {
        throw new Error(removeFileError.message || "Failed to delete attachment file.");
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("attachments")
    .delete()
    .eq("id", params.attachment.id);
  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete attachment.");
  }

  await logBoardActivity({
    action: "attachment.delete",
    boardId: params.boardId,
    entityId: params.attachment.card_id,
    entityType: "card",
    metadata: {
      attachmentId: params.attachment.id,
      sourceType,
    },
    userId: params.access.userId,
    workspaceId: params.access.workspaceId,
  });
}

function resolveInlineErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export async function uploadAttachment(formData: FormData) {
  const input = parseSchemaOrRedirect(uploadAttachmentPathSchema, {
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const file = assertAttachmentFile(formData.get("file"), input.workspaceSlug, input.boardId);
  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId);
  const supabase = await createServerSupabaseClient();
  await ensureActiveCard(supabase, input.workspaceSlug, input.boardId, input.cardId);

  try {
    await uploadSingleAttachment({
      access,
      boardId: input.boardId,
      cardId: input.cardId,
      file,
    });
  } catch (error) {
    const message = resolveInlineErrorMessage(error, "Failed to upload attachment file.");
    redirectBoardError(input.workspaceSlug, input.boardId, message);
  }

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function uploadAttachmentsInline(
  formData: FormData,
): Promise<AttachmentMutationResult> {
  const parsed = uploadAttachmentPathSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    return { error: "Invalid attachment upload payload.", ok: false };
  }

  const entries = formData.getAll("files");
  const files = entries.length > 0 ? toFiles(entries) : toFiles([formData.get("file")].filter(Boolean) as FormDataEntryValue[]);
  if (files.length < 1) {
    return { error: "Please select at least one file.", ok: false };
  }

  if (files.length > 10) {
    return { error: "You can upload up to 10 files at a time.", ok: false };
  }

  for (const file of files) {
    const validationError = resolveAttachmentFileError(file);
    if (validationError) {
      return { error: validationError, ok: false };
    }
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    await ensureActiveCard(supabase, parsed.data.workspaceSlug, parsed.data.boardId, parsed.data.cardId);

    const insertedAttachments: InsertedAttachmentRow[] = [];
    for (const file of files) {
      const insertedAttachment = await uploadSingleAttachment({
        access,
        boardId: parsed.data.boardId,
        cardId: parsed.data.cardId,
        file,
      });
      insertedAttachments.push(insertedAttachment);
    }

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return {
      attachments: insertedAttachments,
      ok: true,
      uploadedCount: files.length,
    };
  } catch (error) {
    return {
      error: resolveInlineErrorMessage(error, "Failed to upload attachments."),
      ok: false,
    };
  }
}

export async function deleteAttachment(formData: FormData) {
  const input = parseSchemaOrRedirect(deleteAttachmentSchema, {
    attachmentId: formData.get("attachmentId"),
    boardId: formData.get("boardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });

  const access = await resolveBoardAccess(input.workspaceSlug, input.boardId);
  const attachment = await loadAttachmentForDelete({
    attachmentId: input.attachmentId,
    boardId: input.boardId,
    workspaceSlug: input.workspaceSlug,
  });

  const supabase = await createServerSupabaseClient();
  await ensureActiveCard(supabase, input.workspaceSlug, input.boardId, attachment.card_id);
  assertDeletePermission({
    access,
    attachment,
    boardId: input.boardId,
    workspaceSlug: input.workspaceSlug,
  });

  try {
    await deleteAttachmentRecord({
      access,
      attachment,
      boardId: input.boardId,
      workspaceSlug: input.workspaceSlug,
    });
  } catch (error) {
    const message = resolveInlineErrorMessage(error, "Failed to delete attachment.");
    redirectBoardError(input.workspaceSlug, input.boardId, message);
  }

  revalidateBoardPath(input.workspaceSlug, input.boardId);
  redirect(boardRoute(input.workspaceSlug, input.boardId));
}

export async function deleteAttachmentInline(
  formData: FormData,
): Promise<AttachmentMutationResult> {
  const parsed = deleteAttachmentSchema.safeParse({
    attachmentId: formData.get("attachmentId"),
    boardId: formData.get("boardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    return { error: "Invalid attachment payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const attachment = await loadAttachmentForDelete({
      attachmentId: parsed.data.attachmentId,
      boardId: parsed.data.boardId,
      workspaceSlug: parsed.data.workspaceSlug,
    });

    const supabase = await createServerSupabaseClient();
    await ensureActiveCard(
      supabase,
      parsed.data.workspaceSlug,
      parsed.data.boardId,
      attachment.card_id,
    );
    if (attachment.created_by !== access.userId && !isManagerRole(access.role)) {
      return { error: "Only creator/admin can delete attachment.", ok: false };
    }

    await deleteAttachmentRecord({
      access,
      attachment,
      boardId: parsed.data.boardId,
      workspaceSlug: parsed.data.workspaceSlug,
    });
    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return { ok: true };
  } catch (error) {
    return {
      error: resolveInlineErrorMessage(error, "Failed to delete attachment."),
      ok: false,
    };
  }
}
