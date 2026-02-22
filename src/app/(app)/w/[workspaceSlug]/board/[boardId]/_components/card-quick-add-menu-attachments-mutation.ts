"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  addAttachmentUrlInline,
  uploadAttachmentsInline,
} from "../actions.card-richness";
import type {
  AttachmentRecord,
  CardRichnessSnapshot,
  WorkspaceMemberRecord,
} from "../types";
import {
  adjustCardAttachmentCountInSnapshot,
  safeBoardSnapshotPatch,
} from "./board-mutations/cache";
import {
  cancelCardRichnessQuery,
  invalidateCardRichnessQuery,
  resolveCardRichnessQueryKey,
} from "./board-mutations/invalidation";
import { boardSnapshotKey } from "./board-mutations/keys";
import type { BoardSnapshotQueryData } from "./board-snapshot-query";
import { EMPTY_CARD_RICHNESS } from "./card-richness-loader";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";

type InlineAttachmentRow = {
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

type AttachmentsMutationVariables = {
  displayText: string;
  selectedFiles: File[];
  url: string;
};

type AttachmentsMutationResult = {
  attachments: AttachmentRecord[];
  errors: string[];
  insertedUrl: boolean;
  uploadedCount: number;
};

type AttachmentsMutationContext = {
  optimisticAttachmentIds: string[];
  previousBoardSnapshot: BoardSnapshotQueryData | undefined;
  previousRichnessSnapshot: CardRichnessSnapshot | undefined;
};

type UseQuickAddAttachmentsMutationParams = {
  attachmentDisplayText: string;
  attachmentUrl: string;
  boardId: string;
  canWrite: boolean;
  cardId: string;
  closePopover: () => void;
  loadRecentAttachmentLinks: () => Promise<void>;
  richnessQueryKey?: readonly [string, string, string, string];
  selectedAttachmentFiles: File[];
  setAttachmentDisplayText: (value: string) => void;
  setAttachmentUrl: (value: string) => void;
  setSelectedAttachmentFiles: (updater: (previous: File[]) => File[]) => void;
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

function sortAttachmentsByCreatedAtDesc(items: AttachmentRecord[]): AttachmentRecord[] {
  return [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function mergeAttachmentsById(items: AttachmentRecord[]): AttachmentRecord[] {
  const seen = new Set<string>();
  const merged: AttachmentRecord[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function resolveAttachmentLabelFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return `${parsed.hostname}${pathname}`;
  } catch {
    return rawUrl;
  }
}

function mapInlineAttachmentRowToRecord(params: {
  memberById: Map<string, WorkspaceMemberRecord>;
  row: InlineAttachmentRow;
}): AttachmentRecord {
  const member = params.memberById.get(params.row.created_by);
  return {
    contentType: params.row.content_type,
    createdAt: params.row.created_at,
    createdBy: params.row.created_by,
    createdByAvatarUrl: member?.avatarUrl ?? null,
    createdByDisplayName: member?.displayName ?? "Bạn",
    externalUrl: params.row.external_url,
    fileName: params.row.file_name,
    id: params.row.id,
    sizeBytes: params.row.size_bytes,
    sourceType: params.row.source_type === "url" ? "url" : "file",
    storagePath: params.row.storage_path,
  };
}

function buildOptimisticAttachments(params: {
  displayText: string;
  selectedFiles: File[];
  url: string;
}): AttachmentRecord[] {
  const now = new Date().toISOString();
  const optimisticAttachments: AttachmentRecord[] = params.selectedFiles.map((file) => ({
    contentType: file.type || null,
    createdAt: now,
    createdBy: "viewer",
    createdByAvatarUrl: null,
    createdByDisplayName: "Bạn",
    externalUrl: null,
    fileName: file.name,
    id: `optimistic-attachment:${crypto.randomUUID()}`,
    sizeBytes: file.size,
    sourceType: "file",
    storagePath: null,
  }));
  if (params.url.trim().length > 0) {
    const label = params.displayText.trim().length > 0
      ? params.displayText.trim()
      : resolveAttachmentLabelFromUrl(params.url.trim());
    optimisticAttachments.push({
      contentType: "text/uri-list",
      createdAt: now,
      createdBy: "viewer",
      createdByAvatarUrl: null,
      createdByDisplayName: "Bạn",
      externalUrl: params.url.trim(),
      fileName: label,
      id: `optimistic-attachment:${crypto.randomUUID()}`,
      sizeBytes: 0,
      sourceType: "url",
      storagePath: null,
    });
  }
  return optimisticAttachments;
}

// eslint-disable-next-line max-lines-per-function
export function useQuickAddAttachmentsMutation(params: UseQuickAddAttachmentsMutationParams) {
  const queryClient = useQueryClient();
  const modalMutationKey = buildCardModalMutationKey({
    boardId: params.boardId,
    cardId: params.cardId,
    workspaceSlug: params.workspaceSlug,
  });
  const resolvedRichnessQueryKey = resolveCardRichnessQueryKey({
    boardId: params.boardId,
    cardId: params.cardId,
    richnessQueryKey: params.richnessQueryKey,
    workspaceSlug: params.workspaceSlug,
  });
  const boardSnapshotQuery = boardSnapshotKey({
    boardId: params.boardId,
    workspaceSlug: params.workspaceSlug,
  });
  const workspaceMemberById = new Map(params.workspaceMembers.map((member) => [member.id, member]));

  const mutation = useMutation<
    AttachmentsMutationResult,
    Error,
    AttachmentsMutationVariables,
    AttachmentsMutationContext
  >({
    mutationKey: [...modalMutationKey, "quick-add-attachments"],
    mutationFn: async (variables) => {
      const trimmedUrl = variables.url.trim();
      const hasUrl = trimmedUrl.length > 0;
      let uploadedCount = 0;
      let insertedUrl = false;
      const errors: string[] = [];
      const attachments: AttachmentRecord[] = [];

      if (variables.selectedFiles.length > 0) {
        const uploadPayload = new FormData();
        uploadPayload.set("boardId", params.boardId);
        uploadPayload.set("cardId", params.cardId);
        uploadPayload.set("workspaceSlug", params.workspaceSlug);
        for (const file of variables.selectedFiles) {
          uploadPayload.append("files", file);
        }

        const uploadResult = await uploadAttachmentsInline(uploadPayload);
        if (uploadResult.ok) {
          uploadedCount = uploadResult.uploadedCount ?? variables.selectedFiles.length;
          const uploadedRows = Array.isArray(uploadResult.attachments)
            ? uploadResult.attachments
            : [];
          attachments.push(
            ...uploadedRows.map((row) => mapInlineAttachmentRowToRecord({
              memberById: workspaceMemberById,
              row: row as InlineAttachmentRow,
            })),
          );
        } else {
          errors.push(uploadResult.error ?? "Không thể tải tệp đính kèm.");
        }
      }

      if (hasUrl) {
        const urlPayload = new FormData();
        urlPayload.set("boardId", params.boardId);
        urlPayload.set("cardId", params.cardId);
        urlPayload.set("workspaceSlug", params.workspaceSlug);
        urlPayload.set("externalUrl", trimmedUrl);
        if (variables.displayText.trim().length > 0) {
          urlPayload.set("displayText", variables.displayText.trim());
        }

        const addUrlResult = await addAttachmentUrlInline(urlPayload);
        if (addUrlResult.ok) {
          insertedUrl = true;
          if (addUrlResult.attachment) {
            attachments.push(
              mapInlineAttachmentRowToRecord({
                memberById: workspaceMemberById,
                row: addUrlResult.attachment as InlineAttachmentRow,
              }),
            );
          }
        } else {
          errors.push(addUrlResult.error ?? "Không thể đính kèm liên kết.");
        }
      }

      if (attachments.length < 1 && errors.length > 0) {
        throw new Error(errors[0] ?? "Không thể chèn đính kèm.");
      }

      return {
        attachments,
        errors,
        insertedUrl,
        uploadedCount,
      };
    },
    onMutate: async (variables) => {
      cancelCardRichnessQuery({
        boardId: params.boardId,
        cardId: params.cardId,
        queryClient,
        richnessQueryKey: params.richnessQueryKey,
        workspaceSlug: params.workspaceSlug,
      });

      const optimisticAttachments = buildOptimisticAttachments({
        displayText: variables.displayText,
        selectedFiles: variables.selectedFiles,
        url: variables.url,
      });
      const previousRichnessSnapshot = queryClient.getQueryData<CardRichnessSnapshot>(resolvedRichnessQueryKey);
      const previousBoardSnapshot = queryClient.getQueryData<BoardSnapshotQueryData>(boardSnapshotQuery);

      if (optimisticAttachments.length > 0) {
        queryClient.setQueryData<CardRichnessSnapshot>(resolvedRichnessQueryKey, (current) => {
          const currentSnapshot = current ?? EMPTY_CARD_RICHNESS;
          return {
            ...currentSnapshot,
            attachments: sortAttachmentsByCreatedAtDesc(
              mergeAttachmentsById([...optimisticAttachments, ...currentSnapshot.attachments]),
            ),
          };
        });
        safeBoardSnapshotPatch(queryClient, boardSnapshotQuery, (snapshot) => adjustCardAttachmentCountInSnapshot({
          cardId: params.cardId,
          delta: optimisticAttachments.length,
          snapshot,
        }));
      }

      return {
        optimisticAttachmentIds: optimisticAttachments.map((attachment) => attachment.id),
        previousBoardSnapshot,
        previousRichnessSnapshot,
      };
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData<CardRichnessSnapshot>(resolvedRichnessQueryKey, context?.previousRichnessSnapshot);
      queryClient.setQueryData<BoardSnapshotQueryData>(boardSnapshotQuery, context?.previousBoardSnapshot);
      toast.error(error.message || "Không thể chèn đính kèm.");
    },
    onSuccess: (result, _variables, context) => {
      if (result.uploadedCount > 0) {
        params.setSelectedAttachmentFiles(() => []);
      }
      if (result.insertedUrl) {
        params.setAttachmentUrl("");
        params.setAttachmentDisplayText("");
        void params.loadRecentAttachmentLinks();
      }

      if (result.attachments.length > 0 && context?.optimisticAttachmentIds.length) {
        const optimisticIds = new Set(context.optimisticAttachmentIds);
        queryClient.setQueryData<CardRichnessSnapshot>(resolvedRichnessQueryKey, (current) => {
          const currentSnapshot = current ?? EMPTY_CARD_RICHNESS;
          const nonOptimisticAttachments = currentSnapshot.attachments.filter(
            (attachment) => !optimisticIds.has(attachment.id),
          );
          return {
            ...currentSnapshot,
            attachments: sortAttachmentsByCreatedAtDesc(
              mergeAttachmentsById([...result.attachments, ...nonOptimisticAttachments]),
            ),
          };
        });

        const delta = result.attachments.length - context.optimisticAttachmentIds.length;
        if (delta !== 0) {
          safeBoardSnapshotPatch(queryClient, boardSnapshotQuery, (snapshot) => adjustCardAttachmentCountInSnapshot({
            cardId: params.cardId,
            delta,
            snapshot,
          }));
        }
      }

      if (result.errors.length > 0) {
        toast.error(result.errors[0] ?? "Không thể chèn đính kèm.");
        return;
      }

      const parts: string[] = [];
      if (result.uploadedCount > 0) {
        parts.push(`đã tải ${result.uploadedCount} tệp`);
      }
      if (result.insertedUrl) {
        parts.push("đã thêm liên kết");
      }
      toast.success(parts.length > 0 ? `Đã chèn: ${parts.join(", ")}.` : "Đã chèn đính kèm.");
      params.closePopover();
    },
    onSettled: () => {
      invalidateCardRichnessQuery({
        boardId: params.boardId,
        cardId: params.cardId,
        queryClient,
        richnessQueryKey: params.richnessQueryKey,
        workspaceSlug: params.workspaceSlug,
      });
      void queryClient.invalidateQueries({ queryKey: boardSnapshotQuery });
    },
  });

  return {
    isSubmitting: mutation.isPending,
    submitAttachments: () => {
      if (!params.canWrite || mutation.isPending) {
        return null;
      }

      const trimmedUrl = params.attachmentUrl.trim();
      const hasUrl = trimmedUrl.length > 0;
      if (params.selectedAttachmentFiles.length < 1 && !hasUrl) {
        return "Chọn tệp hoặc dán liên kết trước khi chèn.";
      }

      mutation.mutate({
        displayText: params.attachmentDisplayText,
        selectedFiles: [...params.selectedAttachmentFiles],
        url: trimmedUrl,
      });
      return null;
    },
  };
}
