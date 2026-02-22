"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { archiveListInline, createCardInline, renameCardInline, renameListInline } from "../../actions.list.inline";
import type { BoardSnapshotQueryData } from "../board-snapshot-query";

import {
  type BoardSnapshotMutationContext,
  insertCardInListSnapshot,
  removeListFromSnapshot,
  safeBoardSnapshotPatch,
  updateCardTitleInSnapshot,
  updateListTitleInSnapshot,
} from "./cache";
import { boardSnapshotKey } from "./keys";

export function useRenameListMutation(params: {
  boardId: string;
  listId: string;
  onRollbackTitle: () => void;
  onSuccessTitle: (title: string) => void;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const snapshotKey = boardSnapshotKey({
    boardId: params.boardId,
    workspaceSlug: params.workspaceSlug,
  });

  return useMutation<
    Awaited<ReturnType<typeof renameListInline>>,
    Error,
    { title: string },
    BoardSnapshotMutationContext
  >({
    mutationFn: async (variables) => renameListInline({
      boardId: params.boardId,
      listId: params.listId,
      title: variables.title,
      workspaceSlug: params.workspaceSlug,
    }),
    onError: (_error, _variables, context) => {
      if (context?.previousSnapshot) {
        queryClient.setQueryData(snapshotKey, context.previousSnapshot);
      }
      params.onRollbackTitle();
      toast.error("Không thể đổi tên danh sách.");
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: snapshotKey });
      const previousSnapshot = queryClient.getQueryData<BoardSnapshotQueryData>(snapshotKey);
      safeBoardSnapshotPatch(queryClient, snapshotKey, (snapshot) => updateListTitleInSnapshot({
        listId: params.listId,
        snapshot,
        title: variables.title,
      }));
      return { previousSnapshot };
    },
    onSuccess: (result, variables, context) => {
      if (!result.ok || !result.list) {
        if (context?.previousSnapshot) {
          queryClient.setQueryData(snapshotKey, context.previousSnapshot);
        }
        params.onRollbackTitle();
        toast.error(result.error ?? "Không thể đổi tên danh sách.");
        return;
      }
      const renamedList = result.list;

      safeBoardSnapshotPatch(queryClient, snapshotKey, (snapshot) => updateListTitleInSnapshot({
        listId: renamedList.id,
        snapshot,
        title: renamedList.title,
      }));
      params.onSuccessTitle(variables.title);
    },
  });
}

export function useCreateCardMutation(params: {
  boardId: string;
  listId: string;
  onCreateSuccess: () => void;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const snapshotKey = boardSnapshotKey({
    boardId: params.boardId,
    workspaceSlug: params.workspaceSlug,
  });

  return useMutation({
    mutationFn: async (variables: { description?: string; title: string }) => createCardInline({
      boardId: params.boardId,
      description: variables.description,
      listId: params.listId,
      title: variables.title,
      workspaceSlug: params.workspaceSlug,
    }),
    onError: () => {
      toast.error("Không thể tạo thẻ.");
    },
    onSuccess: (result) => {
      if (!result.ok || !result.card) {
        toast.error(result.error ?? "Không thể tạo thẻ.");
        return;
      }
      const createdCard = result.card;

      safeBoardSnapshotPatch(queryClient, snapshotKey, (snapshot) => insertCardInListSnapshot({
        card: createdCard,
        snapshot,
      }));
      params.onCreateSuccess();
      toast.success("Đã thêm thẻ.");
    },
  });
}

export function useArchiveListMutation(params: {
  boardId: string;
  listId: string;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const snapshotKey = boardSnapshotKey({
    boardId: params.boardId,
    workspaceSlug: params.workspaceSlug,
  });

  return useMutation<
    Awaited<ReturnType<typeof archiveListInline>>,
    Error,
    void,
    BoardSnapshotMutationContext
  >({
    mutationFn: async () => archiveListInline({
      boardId: params.boardId,
      listId: params.listId,
      workspaceSlug: params.workspaceSlug,
    }),
    onError: (_error, _variables, context) => {
      if (context?.previousSnapshot) {
        queryClient.setQueryData(snapshotKey, context.previousSnapshot);
      }
      toast.error("Không thể lưu trữ danh sách.");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: snapshotKey });
      const previousSnapshot = queryClient.getQueryData<BoardSnapshotQueryData>(snapshotKey);
      safeBoardSnapshotPatch(queryClient, snapshotKey, (snapshot) => removeListFromSnapshot({
        listId: params.listId,
        snapshot,
      }));
      return { previousSnapshot };
    },
    onSuccess: (result, _variables, context) => {
      if (!result.ok || !result.archivedListId) {
        if (context?.previousSnapshot) {
          queryClient.setQueryData(snapshotKey, context.previousSnapshot);
        }
        toast.error(result.error ?? "Không thể lưu trữ danh sách.");
        return;
      }
      toast.success("Đã lưu trữ danh sách.");
    },
  });
}

export function useRenameCardTitleMutation(params: {
  boardId: string;
  cardId: string;
  onRollbackTitle: () => void;
  onSuccessTitle?: (title: string) => void;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const snapshotKey = boardSnapshotKey({
    boardId: params.boardId,
    workspaceSlug: params.workspaceSlug,
  });

  return useMutation<
    Awaited<ReturnType<typeof renameCardInline>>,
    Error,
    { title: string },
    BoardSnapshotMutationContext
  >({
    mutationFn: async (variables) => renameCardInline({
      boardId: params.boardId,
      cardId: params.cardId,
      title: variables.title,
      workspaceSlug: params.workspaceSlug,
    }),
    onError: (_error, _variables, context) => {
      if (context?.previousSnapshot) {
        queryClient.setQueryData(snapshotKey, context.previousSnapshot);
      }
      params.onRollbackTitle();
      toast.error("Không thể đổi tên thẻ.");
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: snapshotKey });
      const previousSnapshot = queryClient.getQueryData<BoardSnapshotQueryData>(snapshotKey);
      safeBoardSnapshotPatch(queryClient, snapshotKey, (snapshot) => updateCardTitleInSnapshot({
        cardId: params.cardId,
        snapshot,
        title: variables.title,
      }));
      params.onSuccessTitle?.(variables.title);
      return { previousSnapshot };
    },
    onSuccess: (result, _variables, context) => {
      if (!result.ok || !result.card) {
        if (context?.previousSnapshot) {
          queryClient.setQueryData(snapshotKey, context.previousSnapshot);
        }
        params.onRollbackTitle();
        toast.error(result.error ?? "Không thể đổi tên thẻ.");
        return;
      }
      const renamedCard = result.card;

      safeBoardSnapshotPatch(queryClient, snapshotKey, (snapshot) => updateCardTitleInSnapshot({
        cardId: renamedCard.id,
        snapshot,
        title: renamedCard.title,
      }));
      params.onSuccessTitle?.(renamedCard.title);
    },
  });
}
