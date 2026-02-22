"use server";
/* eslint-disable max-lines */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { APP_ROUTES, sanitizeUserText } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { ATTACHMENT_BUCKET, boardPathSchema, sanitizeFileName } from "./actions.card-richness.shared";
import {
  boardRoute,
  fetchCardsForBoard,
  logBoardActivity,
  resolveBoardAccess,
  withBoardError,
} from "./actions.shared";
import type { BoardVisibility, WorkspaceRole } from "./types";
import { canWriteBoardByRole, resolveInsertPosition } from "./utils";

const copyCardSchema = boardPathSchema.extend({
  cardId: z.string().uuid(),
});

const copyCardWithOptionsSchema = boardPathSchema.extend({
  cardId: z.string().uuid(),
  includeAttachments: z.boolean(),
  includeChecklist: z.boolean(),
  includeCustomFields: z.boolean(),
  includeMembers: z.boolean(),
  targetBoardId: z.string().uuid(),
  targetListId: z.string().uuid(),
  targetPositionIndex: z.coerce.number().int().min(1).max(10000),
  title: z.string().trim().min(1).max(500),
});
const copyDestinationOptionsSchema = boardPathSchema.extend({
  cardId: z.string().uuid(),
});

const toggleCardWatchSchema = boardPathSchema.extend({
  cardId: z.string().uuid(),
});

type SourceCard = {
  description: string | null;
  due_at: string | null;
  effort: string | null;
  has_due_time: boolean;
  has_start_time: boolean;
  id: string;
  list_id: string;
  priority: string | null;
  recurrence_anchor_at: string | null;
  recurrence_rrule: string | null;
  recurrence_tz: string | null;
  reminder_offset_minutes: number | null;
  start_at: string | null;
  status: string | null;
  title: string;
};

type SupabaseQueryErrorLike = {
  code?: string;
  message: string;
};

type CopyDestinationBoardOption = {
  id: string;
  name: string;
};
type CopyDestinationListOption = {
  cardCount: number;
  id: string;
  title: string;
};
type CopyDestinationOptions = {
  boards: CopyDestinationBoardOption[];
  currentBoardId: string;
  listsByBoard: Record<string, CopyDestinationListOption[]>;
};

function isMissingTableSchemaCacheError(
  error: SupabaseQueryErrorLike | null,
  tableName: string,
): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST205" || error.code === "42P01") {
    return true;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes(tableName.toLowerCase()) &&
    (normalizedMessage.includes("schema cache") || normalizedMessage.includes("could not find the table"))
  );
}

function buildCopyCardTitle(title: string): string {
  const normalized = sanitizeUserText(`Copy of ${title}`).slice(0, 500);
  return normalized.length > 0 ? normalized : "Copied card";
}

function sanitizeCopyTitle(title: string): string {
  const normalized = sanitizeUserText(title).slice(0, 500);
  return normalized.length > 0 ? normalized : "Copied card";
}

function isAttachmentStoragePathUniqueError(error: SupabaseQueryErrorLike | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "23505" && error.message.toLowerCase().includes("attachments_storage_path_unique")) {
    return true;
  }

  return error.message.toLowerCase().includes("attachments_storage_path_unique");
}

function createCopiedAttachmentStoragePath(params: {
  fileName: string;
  targetBoardId: string;
  targetCardId: string;
  targetWorkspaceId: string;
}): string {
  const attachmentId = crypto.randomUUID();
  const safeFileName = sanitizeFileName(params.fileName);
  return `workspaces/${params.targetWorkspaceId}/boards/${params.targetBoardId}/cards/${params.targetCardId}/${attachmentId}-${safeFileName}`;
}

function parseFormBoolean(value: FormDataEntryValue | null, defaultValue: boolean): boolean {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "off") {
    return false;
  }

  return defaultValue;
}

async function loadSourceCard(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}): Promise<SourceCard> {
  const supabase = await createServerSupabaseClient();
  const { data: sourceCard, error } = await supabase
    .from("cards")
    .select("id, title, description, due_at, start_at, has_start_time, has_due_time, reminder_offset_minutes, recurrence_rrule, recurrence_anchor_at, recurrence_tz, list_id, status, priority, effort")
    .eq("id", params.cardId)
    .eq("board_id", params.boardId)
    .is("archived_at", null)
    .maybeSingle();

  if (!sourceCard || error) {
    redirect(
      withBoardError(
        params.workspaceSlug,
        params.boardId,
        error?.message ?? "Card not found.",
      ),
    );
  }

  return sourceCard as SourceCard;
}

// eslint-disable-next-line max-lines-per-function
async function copyCardRelations(params: {
  boardId: string;
  copiedCardId: string;
  includeAttachments: boolean;
  includeChecklist: boolean;
  includeLabels: boolean;
  includeMembers: boolean;
  sourceCardId: string;
  targetBoardId: string;
  targetWorkspaceId: string;
  userId: string;
  workspaceSlug: string;
}) {
  const supabase = await createServerSupabaseClient();
  if (params.includeLabels) {
    const { data: sourceLabels, error: sourceLabelsError } = await supabase
      .from("card_labels")
      .select("label_id")
      .eq("card_id", params.sourceCardId);
    if (sourceLabelsError) {
      redirect(
        withBoardError(
          params.workspaceSlug,
          params.boardId,
          sourceLabelsError.message ?? "Failed to copy card labels.",
        ),
      );
    }

    if ((sourceLabels ?? []).length > 0) {
      const { error } = await supabase.from("card_labels").insert(
        (sourceLabels ?? []).map((entry) => ({
          card_id: params.copiedCardId,
          label_id: entry.label_id as string,
        })),
      );
      if (error) {
        redirect(withBoardError(params.workspaceSlug, params.boardId, error.message));
      }
    }
  }

  if (params.includeMembers) {
    const { data: sourceAssignees, error: sourceAssigneesError } = await supabase
      .from("card_assignees")
      .select("user_id")
      .eq("card_id", params.sourceCardId);
    if (sourceAssigneesError) {
      redirect(withBoardError(params.workspaceSlug, params.boardId, sourceAssigneesError.message));
    }

    const sourceAssigneeIds = ((sourceAssignees ?? []) as Array<{ user_id: string }>)
      .map((entry) => entry.user_id)
      .filter((entry) => entry.trim().length > 0);
    if (sourceAssigneeIds.length > 0) {
      const { data: targetWorkspaceMembers, error: targetWorkspaceMembersError } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", params.targetWorkspaceId)
        .in("user_id", sourceAssigneeIds);
      if (targetWorkspaceMembersError) {
        redirect(withBoardError(params.workspaceSlug, params.boardId, targetWorkspaceMembersError.message));
      }

      const validAssigneeIds = new Set(
        ((targetWorkspaceMembers ?? []) as Array<{ user_id: string }>)
          .map((entry) => entry.user_id)
          .filter((entry) => entry.trim().length > 0),
      );
      const assigneeInsertPayload = sourceAssigneeIds
        .filter((userId) => validAssigneeIds.has(userId))
        .map((userId) => ({
          card_id: params.copiedCardId,
          user_id: userId,
        }));

      if (assigneeInsertPayload.length > 0) {
        const { error } = await supabase.from("card_assignees").insert(
          assigneeInsertPayload,
        );
        if (error) {
          redirect(withBoardError(params.workspaceSlug, params.boardId, error.message));
        }
      }
    }
  }

  if (params.includeChecklist) {
    const { data: sourceChecklists, error: sourceChecklistsError } = await supabase
      .from("card_checklists")
      .select("id, title, position")
      .eq("card_id", params.sourceCardId)
      .order("position", { ascending: true });
    if (sourceChecklistsError) {
      redirect(withBoardError(params.workspaceSlug, params.boardId, sourceChecklistsError.message));
    }

    const sourceChecklistRows = (sourceChecklists ?? []) as Array<{
      id: string;
      position: number | string;
      title: string;
    }>;
    if (sourceChecklistRows.length > 0) {
      const sourceChecklistIds = sourceChecklistRows.map((entry) => entry.id);
      const { data: sourceChecklistItems, error: sourceChecklistItemsError } = await supabase
        .from("card_checklist_items")
        .select("checklist_id, body, is_done, position")
        .in("checklist_id", sourceChecklistIds)
        .order("position", { ascending: true });

      if (sourceChecklistItemsError) {
        redirect(withBoardError(params.workspaceSlug, params.boardId, sourceChecklistItemsError.message));
      }

      const checklistIdMap = new Map<string, string>();
      for (const sourceChecklist of sourceChecklistRows) {
        const { data: insertedChecklist, error: insertChecklistError } = await supabase
          .from("card_checklists")
          .insert({
            card_id: params.copiedCardId,
            created_by: params.userId,
            position: sourceChecklist.position,
            title: sourceChecklist.title,
          })
          .select("id")
          .single();

        if (!insertedChecklist || insertChecklistError) {
          redirect(withBoardError(params.workspaceSlug, params.boardId, insertChecklistError?.message ?? "Failed to copy checklist."));
        }

        checklistIdMap.set(sourceChecklist.id, insertedChecklist.id);
      }

      const sourceItemRows = (sourceChecklistItems ?? []) as Array<{
        body: string;
        checklist_id: string;
        is_done: boolean;
        position: number | string;
      }>;
      if (sourceItemRows.length > 0) {
        const itemInsertPayload = sourceItemRows
          .map((entry) => {
            const mappedChecklistId = checklistIdMap.get(entry.checklist_id);
            if (!mappedChecklistId) {
              return null;
            }
            return {
              body: entry.body,
              checklist_id: mappedChecklistId,
              created_by: params.userId,
              is_done: entry.is_done,
              position: entry.position,
            };
          })
          .filter((entry): entry is {
            body: string;
            checklist_id: string;
            created_by: string;
            is_done: boolean;
            position: number | string;
          } => entry !== null);

        if (itemInsertPayload.length > 0) {
          const { error: insertItemsError } = await supabase
            .from("card_checklist_items")
            .insert(itemInsertPayload);
          if (insertItemsError) {
            redirect(withBoardError(params.workspaceSlug, params.boardId, insertItemsError.message));
          }
        }
      }
    }
  }

  if (params.includeAttachments) {
    const { data: sourceAttachments, error: sourceAttachmentsError } = await supabase
      .from("attachments")
      .select("source_type, storage_path, external_url, file_name, content_type, size_bytes")
      .eq("card_id", params.sourceCardId);
    if (sourceAttachmentsError) {
      redirect(withBoardError(params.workspaceSlug, params.boardId, sourceAttachmentsError.message));
    }

    type AttachmentInsertRow = {
      card_id: string;
      content_type: string | null;
      created_by: string;
      external_url: string | null;
      file_name: string;
      size_bytes: number;
      source_type: "file" | "url";
      storage_path: string | null;
    };
    const attachmentPayload: AttachmentInsertRow[] = ((sourceAttachments ?? []) as Array<{
      content_type: string | null;
      external_url: string | null;
      file_name: string;
      size_bytes: number;
      source_type: string | null;
      storage_path: string | null;
    }>).reduce<AttachmentInsertRow[]>((rows, entry) => {
      const sourceType = entry.source_type === "url" ? "url" : "file";
      if (sourceType === "file") {
        if (!entry.storage_path || entry.storage_path.trim().length < 1) {
          return rows;
        }

        rows.push({
          card_id: params.copiedCardId,
          content_type: entry.content_type,
          created_by: params.userId,
          external_url: null,
          file_name: entry.file_name,
          size_bytes: Number.isFinite(entry.size_bytes) ? entry.size_bytes : 0,
          source_type: "file",
          storage_path: entry.storage_path,
        });
        return rows;
      }

      if (!entry.external_url || entry.external_url.trim().length < 1) {
        return rows;
      }

      rows.push({
        card_id: params.copiedCardId,
        content_type: entry.content_type ?? "text/uri-list",
        created_by: params.userId,
        external_url: entry.external_url,
        file_name: entry.file_name,
        size_bytes: Number.isFinite(entry.size_bytes) ? entry.size_bytes : 0,
        source_type: "url",
        storage_path: null,
      });
      return rows;
    }, []);

    const urlAttachments = attachmentPayload.filter((entry) => entry.source_type === "url");
    if (urlAttachments.length > 0) {
      const { error: insertUrlAttachmentsError } = await supabase
        .from("attachments")
        .insert(urlAttachments);
      if (insertUrlAttachmentsError) {
        redirect(withBoardError(params.workspaceSlug, params.boardId, insertUrlAttachmentsError.message));
      }
    }

    const fileAttachments = attachmentPayload.filter((entry) => entry.source_type === "file");
    for (const fileAttachment of fileAttachments) {
      const { error: insertFileAttachmentError } = await supabase
        .from("attachments")
        .insert(fileAttachment);
      if (!insertFileAttachmentError) {
        continue;
      }

      if (!isAttachmentStoragePathUniqueError(insertFileAttachmentError)) {
        redirect(withBoardError(params.workspaceSlug, params.boardId, insertFileAttachmentError.message));
      }

      const sourceStoragePath = fileAttachment.storage_path;
      if (!sourceStoragePath || sourceStoragePath.trim().length < 1) {
        redirect(withBoardError(params.workspaceSlug, params.boardId, "Source attachment path is missing."));
      }

      const copiedStoragePath = createCopiedAttachmentStoragePath({
        fileName: fileAttachment.file_name,
        targetBoardId: params.targetBoardId,
        targetCardId: params.copiedCardId,
        targetWorkspaceId: params.targetWorkspaceId,
      });
      const { error: copyStorageError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .copy(sourceStoragePath, copiedStoragePath);
      if (copyStorageError) {
        redirect(withBoardError(params.workspaceSlug, params.boardId, copyStorageError.message));
      }

      const { error: insertCopiedFileAttachmentError } = await supabase
        .from("attachments")
        .insert({
          ...fileAttachment,
          storage_path: copiedStoragePath,
        });
      if (insertCopiedFileAttachmentError) {
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([copiedStoragePath]);
        redirect(withBoardError(params.workspaceSlug, params.boardId, insertCopiedFileAttachmentError.message));
      }
    }
  }
}

type CopyCardPersistResult =
  | { ok: true; copiedCardId: string; targetBoardId: string }
  | { error: string; ok: false };
type CopyDestinationOptionsPersistResult =
  | { ok: true; options: CopyDestinationOptions }
  | { error: string; ok: false };
type ToggleCardWatchPersistResult =
  | { ok: true; watchCountDelta: -1 | 1; watchedByViewer: boolean }
  | { error: string; ok: false };

function parseCopyCardFormData(formData: FormData) {
  return copyCardSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

function parseCopyCardWithOptionsFormData(formData: FormData) {
  return copyCardWithOptionsSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    includeAttachments: parseFormBoolean(formData.get("includeAttachments"), true),
    includeChecklist: parseFormBoolean(formData.get("includeChecklist"), true),
    includeCustomFields: parseFormBoolean(formData.get("includeCustomFields"), true),
    includeMembers: parseFormBoolean(formData.get("includeMembers"), true),
    targetBoardId: formData.get("targetBoardId"),
    targetListId: formData.get("targetListId"),
    targetPositionIndex: formData.get("targetPositionIndex"),
    title: formData.get("title"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

function parseCopyDestinationOptionsFormData(formData: FormData) {
  return copyDestinationOptionsSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

function parseToggleCardWatchFormData(formData: FormData) {
  return toggleCardWatchSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    workspaceSlug: formData.get("workspaceSlug"),
  });
}

function resolveRedirectDigestMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeDigest = "digest" in error ? (error as { digest?: unknown }).digest : undefined;
  if (typeof maybeDigest !== "string" || !maybeDigest.includes("NEXT_REDIRECT")) {
    return null;
  }

  const digestParts = maybeDigest.split(";");
  const redirectPath = digestParts.find((entry) => entry.includes("?message="));
  if (!redirectPath) {
    return "Yêu cầu đã chuyển hướng. Vui lòng tải lại trang rồi thử lại.";
  }

  try {
    const parsedUrl = new URL(redirectPath, "http://localhost");
    const message = parsedUrl.searchParams.get("message");
    if (message && message.trim().length > 0) {
      return message.trim();
    }
  } catch {
    return "Yêu cầu đã chuyển hướng. Vui lòng tải lại trang rồi thử lại.";
  }

  return "Yêu cầu đã chuyển hướng. Vui lòng tải lại trang rồi thử lại.";
}

function resolveInlineErrorMessage(error: unknown, fallback: string): string {
  const redirectDigestMessage = resolveRedirectDigestMessage(error);
  if (redirectDigestMessage) {
    return redirectDigestMessage;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

async function persistCopyCard(payload: z.infer<typeof copyCardSchema>): Promise<CopyCardPersistResult> {
  const sourceCard = await loadSourceCard({
    boardId: payload.boardId,
    cardId: payload.cardId,
    workspaceSlug: payload.workspaceSlug,
  });
  const optionsParsed = copyCardWithOptionsSchema.safeParse({
    boardId: payload.boardId,
    cardId: payload.cardId,
    includeAttachments: true,
    includeChecklist: true,
    includeCustomFields: true,
    includeMembers: true,
    targetBoardId: payload.boardId,
    targetListId: sourceCard.list_id,
    targetPositionIndex: 10000,
    title: buildCopyCardTitle(sourceCard.title),
    workspaceSlug: payload.workspaceSlug,
  });
  if (!optionsParsed.success) {
    return { error: "Invalid copy payload.", ok: false };
  }

  return persistCopyCardWithOptions(optionsParsed.data);
}

async function persistCopyDestinationOptions(
  payload: z.infer<typeof copyDestinationOptionsSchema>,
): Promise<CopyDestinationOptionsPersistResult> {
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  await loadSourceCard({
    boardId: payload.boardId,
    cardId: payload.cardId,
    workspaceSlug: payload.workspaceSlug,
  });

  const supabase = await createServerSupabaseClient();
  const { data: boardsData, error: boardsError } = await supabase
    .from("boards")
    .select("id, name, visibility, created_by, workspace_id")
    .eq("workspace_id", access.workspaceId)
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (boardsError) {
    return { error: boardsError.message, ok: false };
  }

  const writableBoards = ((boardsData ?? []) as Array<{
    created_by: string;
    id: string;
    name: string;
    visibility: BoardVisibility;
    workspace_id: string;
  }>).filter((entry) => canWriteBoardByRole({
    board: { created_by: entry.created_by, visibility: entry.visibility },
    role: access.role as WorkspaceRole,
    userId: access.userId,
  }));
  if (writableBoards.length < 1) {
    return { error: "No writable board found in current workspace.", ok: false };
  }

  const orderedBoards = writableBoards
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
    }))
    .sort((left, right) => {
      if (left.id === payload.boardId) {
        return -1;
      }
      if (right.id === payload.boardId) {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });
  const boardIds = orderedBoards.map((entry) => entry.id);

  const { data: listsData, error: listsError } = await supabase
    .from("lists")
    .select("id, title, board_id, position")
    .in("board_id", boardIds)
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (listsError) {
    return { error: listsError.message, ok: false };
  }

  const { data: cardsData, error: cardsError } = await supabase
    .from("cards")
    .select("id, list_id, board_id")
    .in("board_id", boardIds)
    .is("archived_at", null);
  if (cardsError) {
    return { error: cardsError.message, ok: false };
  }

  const cardCountByListId = new Map<string, number>();
  for (const cardRow of (cardsData ?? []) as Array<{ list_id: string | null }>) {
    if (!cardRow.list_id) {
      continue;
    }

    cardCountByListId.set(cardRow.list_id, (cardCountByListId.get(cardRow.list_id) ?? 0) + 1);
  }

  const listsByBoard = Object.fromEntries(
    boardIds.map((boardId) => [boardId, [] as CopyDestinationListOption[]]),
  ) as Record<string, CopyDestinationListOption[]>;
  for (const listRow of (listsData ?? []) as Array<{
    board_id: string;
    id: string;
    title: string;
  }>) {
    if (!listsByBoard[listRow.board_id]) {
      listsByBoard[listRow.board_id] = [];
    }
    listsByBoard[listRow.board_id].push({
      cardCount: cardCountByListId.get(listRow.id) ?? 0,
      id: listRow.id,
      title: listRow.title,
    });
  }

  return {
    ok: true,
    options: {
      boards: orderedBoards,
      currentBoardId: payload.boardId,
      listsByBoard,
    },
  };
}

async function persistCopyCardWithOptions(
  payload: z.infer<typeof copyCardWithOptionsSchema>,
): Promise<CopyCardPersistResult> {
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId);
  const sourceCard = await loadSourceCard({
    boardId: payload.boardId,
    cardId: payload.cardId,
    workspaceSlug: payload.workspaceSlug,
  });
  const supabase = await createServerSupabaseClient();
  const { data: targetBoard, error: targetBoardError } = await supabase
    .from("boards")
    .select("id, workspace_id, visibility, created_by")
    .eq("id", payload.targetBoardId)
    .is("archived_at", null)
    .maybeSingle();
  if (!targetBoard || targetBoardError) {
    return { error: targetBoardError?.message ?? "Target board not found.", ok: false };
  }

  const typedTargetBoard = targetBoard as {
    created_by: string;
    id: string;
    visibility: BoardVisibility;
    workspace_id: string;
  };
  if (typedTargetBoard.workspace_id !== access.workspaceId) {
    return { error: "Target board must belong to current workspace.", ok: false };
  }

  if (!canWriteBoardByRole({
    board: { created_by: typedTargetBoard.created_by, visibility: typedTargetBoard.visibility },
    role: access.role as WorkspaceRole,
    userId: access.userId,
  })) {
    return { error: "You don't have permission to write to the target board.", ok: false };
  }

  const { data: targetList, error: targetListError } = await supabase
    .from("lists")
    .select("id")
    .eq("id", payload.targetListId)
    .eq("board_id", typedTargetBoard.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!targetList || targetListError) {
    return { error: targetListError?.message ?? "Target list not found.", ok: false };
  }

  const cards = await fetchCardsForBoard(typedTargetBoard.id);
  const cardsInTargetList = cards.filter((entry) => entry.list_id === payload.targetListId);
  const nextPosition = resolveInsertPosition(cardsInTargetList, payload.targetPositionIndex);

  const { data: copiedCard, error: copiedCardError } = await supabase
    .from("cards")
    .insert({
      board_id: typedTargetBoard.id,
      created_by: access.userId,
      description: sourceCard.description,
      due_at: sourceCard.due_at,
      effort: payload.includeCustomFields ? sourceCard.effort : null,
      has_due_time: sourceCard.has_due_time,
      has_start_time: sourceCard.has_start_time,
      list_id: payload.targetListId,
      position: nextPosition,
      priority: payload.includeCustomFields ? sourceCard.priority : null,
      recurrence_anchor_at: sourceCard.recurrence_anchor_at,
      recurrence_rrule: sourceCard.recurrence_rrule,
      recurrence_tz: sourceCard.recurrence_tz,
      reminder_offset_minutes: sourceCard.reminder_offset_minutes,
      start_at: sourceCard.start_at,
      status: payload.includeCustomFields ? sourceCard.status : null,
      title: sanitizeCopyTitle(payload.title),
    })
    .select("id")
    .single();
  if (!copiedCard || copiedCardError) {
    return { error: copiedCardError?.message ?? "Failed to copy card.", ok: false };
  }

  await copyCardRelations({
    boardId: payload.boardId,
    copiedCardId: copiedCard.id,
    includeAttachments: payload.includeAttachments,
    includeChecklist: payload.includeChecklist,
    includeLabels: typedTargetBoard.id === payload.boardId,
    includeMembers: payload.includeMembers,
    sourceCardId: sourceCard.id,
    targetBoardId: typedTargetBoard.id,
    targetWorkspaceId: typedTargetBoard.workspace_id,
    userId: access.userId,
    workspaceSlug: payload.workspaceSlug,
  });

  await logBoardActivity({
    action: "copy",
    boardId: typedTargetBoard.id,
    entityId: copiedCard.id,
    entityType: "card",
    metadata: {
      crossBoard: payload.boardId !== typedTargetBoard.id,
      includeAttachments: payload.includeAttachments,
      includeChecklist: payload.includeChecklist,
      includeCustomFields: payload.includeCustomFields,
      includeMembers: payload.includeMembers,
      sourceCardId: sourceCard.id,
      sourceBoardId: payload.boardId,
      targetBoardId: typedTargetBoard.id,
      targetListId: payload.targetListId,
      targetPositionIndex: payload.targetPositionIndex,
    },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(boardRoute(payload.workspaceSlug, payload.boardId));
  if (typedTargetBoard.id !== payload.boardId) {
    revalidatePath(boardRoute(payload.workspaceSlug, typedTargetBoard.id));
  }
  return { copiedCardId: copiedCard.id, ok: true, targetBoardId: typedTargetBoard.id };
}

async function persistToggleCardWatch(
  payload: z.infer<typeof toggleCardWatchSchema>,
): Promise<ToggleCardWatchPersistResult> {
  const access = await resolveBoardAccess(payload.workspaceSlug, payload.boardId, {
    requiredPermission: "read",
  });
  const canonicalBoardRoute = boardRoute(payload.workspaceSlug, payload.boardId);
  const supabase = await createServerSupabaseClient();
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id")
    .eq("id", payload.cardId)
    .eq("board_id", payload.boardId)
    .is("archived_at", null)
    .maybeSingle();

  if (!card || cardError) {
    return { error: cardError?.message ?? "Card not found.", ok: false };
  }

  const { data: existingWatch, error: existingWatchError } = await supabase
    .from("card_watchers")
    .select("card_id, user_id")
    .eq("card_id", payload.cardId)
    .eq("user_id", access.userId)
    .maybeSingle();

  if (existingWatchError) {
    if (isMissingTableSchemaCacheError(existingWatchError, "card_watchers")) {
      revalidatePath(canonicalBoardRoute);
      return { error: "Watch table is unavailable in current schema cache.", ok: false };
    }

    return { error: existingWatchError.message, ok: false };
  }

  const nextWatched = !existingWatch;
  if (nextWatched) {
    const { error } = await supabase
      .from("card_watchers")
      .insert({ card_id: payload.cardId, user_id: access.userId });
    if (error) {
      if (isMissingTableSchemaCacheError(error, "card_watchers")) {
        revalidatePath(canonicalBoardRoute);
        return { error: "Watch table is unavailable in current schema cache.", ok: false };
      }

      return { error: error.message, ok: false };
    }
  } else {
    const { error } = await supabase
      .from("card_watchers")
      .delete()
      .eq("card_id", payload.cardId)
      .eq("user_id", access.userId);
    if (error) {
      if (isMissingTableSchemaCacheError(error, "card_watchers")) {
        revalidatePath(canonicalBoardRoute);
        return { error: "Watch table is unavailable in current schema cache.", ok: false };
      }

      return { error: error.message, ok: false };
    }
  }

  await logBoardActivity({
    action: nextWatched ? "watch.add" : "watch.remove",
    boardId: payload.boardId,
    entityId: payload.cardId,
    entityType: "card",
    metadata: { watched: nextWatched },
    userId: access.userId,
    workspaceId: access.workspaceId,
  });

  revalidatePath(canonicalBoardRoute);
  return {
    ok: true,
    watchCountDelta: nextWatched ? 1 : -1,
    watchedByViewer: nextWatched,
  };
}

export async function copyCard(formData: FormData) {
  const parsed = parseCopyCardFormData(formData);
  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const persistResult = await persistCopyCard(parsed.data);
  if (!persistResult.ok) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, persistResult.error));
  }

  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function copyCardInline(
  formData: FormData,
): Promise<{ copiedCardId?: string; error?: string; ok: boolean; targetBoardId?: string }> {
  const parsed = parseCopyCardFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid copy payload.", ok: false };
  }

  try {
    const persistResult = await persistCopyCard(parsed.data);
    if (!persistResult.ok) {
      return { error: persistResult.error, ok: false };
    }

    return {
      copiedCardId: persistResult.copiedCardId,
      ok: true,
      targetBoardId: persistResult.targetBoardId,
    };
  } catch (error) {
    return { error: resolveInlineErrorMessage(error, "Failed to copy card."), ok: false };
  }
}

export async function copyCardWithOptionsInline(
  formData: FormData,
): Promise<{ copiedCardId?: string; error?: string; ok: boolean; targetBoardId?: string }> {
  const parsed = parseCopyCardWithOptionsFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid copy options payload.", ok: false };
  }

  try {
    const persistResult = await persistCopyCardWithOptions(parsed.data);
    if (!persistResult.ok) {
      return { error: persistResult.error, ok: false };
    }

    return {
      copiedCardId: persistResult.copiedCardId,
      ok: true,
      targetBoardId: persistResult.targetBoardId,
    };
  } catch (error) {
    return { error: resolveInlineErrorMessage(error, "Failed to copy card with options."), ok: false };
  }
}

export async function getCopyDestinationOptionsInline(
  formData: FormData,
): Promise<{ error?: string; ok: boolean; options?: CopyDestinationOptions }> {
  const parsed = parseCopyDestinationOptionsFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid copy destination payload.", ok: false };
  }

  try {
    const persistResult = await persistCopyDestinationOptions(parsed.data);
    if (!persistResult.ok) {
      return { error: persistResult.error, ok: false };
    }

    return {
      ok: true,
      options: persistResult.options,
    };
  } catch (error) {
    return { error: resolveInlineErrorMessage(error, "Failed to load copy destinations."), ok: false };
  }
}

export async function toggleCardWatch(formData: FormData) {
  const parsed = parseToggleCardWatchFormData(formData);
  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const persistResult = await persistToggleCardWatch(parsed.data);
  if (!persistResult.ok) {
    redirect(withBoardError(parsed.data.workspaceSlug, parsed.data.boardId, persistResult.error));
  }

  redirect(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));
}

export async function toggleCardWatchInline(
  formData: FormData,
): Promise<{ error?: string; ok: boolean; watchCountDelta?: -1 | 1; watchedByViewer?: boolean }> {
  const parsed = parseToggleCardWatchFormData(formData);
  if (!parsed.success) {
    return { error: "Invalid watch payload.", ok: false };
  }

  try {
    const persistResult = await persistToggleCardWatch(parsed.data);
    if (!persistResult.ok) {
      return { error: persistResult.error, ok: false };
    }

    return {
      ok: true,
      watchCountDelta: persistResult.watchCountDelta,
      watchedByViewer: persistResult.watchedByViewer,
    };
  } catch (error) {
    return { error: resolveInlineErrorMessage(error, "Failed to update watch."), ok: false };
  }
}
