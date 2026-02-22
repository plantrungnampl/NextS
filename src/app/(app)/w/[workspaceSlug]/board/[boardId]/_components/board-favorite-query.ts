"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toggleBoardFavoriteInline } from "../actions.favorite.inline";

export function buildBoardFavoriteQueryKey(params: {
  boardId: string;
}) {
  return ["board-favorite", params.boardId] as const;
}

export function useBoardFavoriteQuery(params: {
  boardId: string;
  initialIsFavorite: boolean;
}) {
  const queryClient = useQueryClient();
  const queryKey = buildBoardFavoriteQueryKey({ boardId: params.boardId });

  return useQuery({
    initialData: params.initialIsFavorite,
    queryFn: () => {
      const cachedFavoriteState = queryClient.getQueryData<boolean>(queryKey);
      return typeof cachedFavoriteState === "boolean" ? cachedFavoriteState : params.initialIsFavorite;
    },
    queryKey,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useToggleBoardFavoriteMutation(params: {
  boardId: string;
  initialIsFavorite: boolean;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = buildBoardFavoriteQueryKey({ boardId: params.boardId });

  return useMutation({
    mutationFn: async (nextFavorite: boolean) =>
      toggleBoardFavoriteInline({
        boardId: params.boardId,
        nextFavorite,
        workspaceSlug: params.workspaceSlug,
      }),
    onError: (_, __, context) => {
      queryClient.setQueryData(queryKey, context?.previousIsFavorite ?? params.initialIsFavorite);
      toast.error("Không thể cập nhật bảng yêu thích.");
    },
    onMutate: async (nextFavorite: boolean) => {
      await queryClient.cancelQueries({ queryKey });
      const previousIsFavorite = queryClient.getQueryData<boolean>(queryKey);
      queryClient.setQueryData(queryKey, nextFavorite);
      return {
        previousIsFavorite:
          typeof previousIsFavorite === "boolean" ? previousIsFavorite : params.initialIsFavorite,
      };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    onSuccess: (result, _, context) => {
      if (!result.ok) {
        queryClient.setQueryData(queryKey, context?.previousIsFavorite ?? params.initialIsFavorite);
        toast.error(result.error ?? "Không thể cập nhật bảng yêu thích.");
        return;
      }

      queryClient.setQueryData(queryKey, result.isFavorite);
    },
  });
}
