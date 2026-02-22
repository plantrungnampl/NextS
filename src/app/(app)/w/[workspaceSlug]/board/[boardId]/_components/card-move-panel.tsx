"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, LoadingInline } from "@/components/ui";
import { APP_ROUTES } from "@/core";
import { cn } from "@/shared";

import {
  getMoveDestinationOptionsInline,
  moveCardInline,
  upsertPrivateInboxItemInline,
} from "../actions.card-modal";
import type { CardRecord } from "../types";
import { invalidateCardRichnessQuery } from "./board-mutations/invalidation";
import type { BoardOptimisticChange } from "./board-dnd-helpers";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";

type MovePanelOptimisticPatch = Partial<Pick<CardRecord, "list_id">>;

type CardMovePanelProps = {
  boardId: string;
  boardName: string;
  canWrite: boolean;
  cardId: string;
  defaultListId: string;
  listOptions: Array<{ id: string; title: string }>;
  onOpenChange: (open: boolean) => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onOptimisticCardPatch?: (patch: MovePanelOptimisticPatch) => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
};

type MovePanelDraftState = {
  targetBoardId: string;
  targetListId: string;
  targetPosition: string;
};
type MovePanelTab = "boardInfo" | "inbox";

const LAST_POSITION_VALUE = "last";
const FALLBACK_POSITION_OPTIONS = Array.from({ length: 10 }, (_, index) => String(index + 1));

function buildInitialDraftState(params: {
  boardId: string;
  defaultListId: string;
}): MovePanelDraftState {
  return {
    targetBoardId: params.boardId,
    targetListId: params.defaultListId,
    targetPosition: "1",
  };
}

function buildDynamicPositionOptions(cardCount: number | undefined): string[] {
  if (typeof cardCount !== "number" || !Number.isFinite(cardCount)) {
    return FALLBACK_POSITION_OPTIONS;
  }

  const totalPositions = Math.max(1, Math.floor(cardCount) + 1);
  return Array.from({ length: totalPositions }, (_, index) => String(index + 1));
}

// eslint-disable-next-line max-lines-per-function
export function CardMovePanel({
  boardId,
  boardName,
  canWrite,
  cardId,
  defaultListId,
  listOptions,
  onOpenChange,
  onOptimisticBoardChange,
  onOptimisticCardPatch,
  richnessQueryKey,
  workspaceSlug,
}: CardMovePanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MovePanelTab>("boardInfo");
  const [draftState, setDraftState] = useState(() => buildInitialDraftState({ boardId, defaultListId }));
  const [inboxPosition, setInboxPosition] = useState("1");
  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId,
    workspaceSlug,
  });

  const destinationQuery = useQuery({
    enabled: canWrite,
    queryKey: [...modalMutationKey, "move-destination-options"],
    queryFn: async () => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("cardId", cardId);
      formData.set("workspaceSlug", workspaceSlug);
      return getMoveDestinationOptionsInline(formData);
    },
  });
  const destinationOptions = destinationQuery.data?.ok ? destinationQuery.data.options : undefined;
  const boardOptions = destinationOptions?.boards ?? [{ id: boardId, name: boardName }];
  const resolvedTargetBoardId = useMemo(() => {
    if (boardOptions.some((boardOption) => boardOption.id === draftState.targetBoardId)) {
      return draftState.targetBoardId;
    }
    if (boardOptions.some((boardOption) => boardOption.id === boardId)) {
      return boardId;
    }
    return boardOptions[0]?.id ?? "";
  }, [boardId, boardOptions, draftState.targetBoardId]);
  const listsForTargetBoard = useMemo(() => {
    if (destinationOptions) {
      return destinationOptions.listsByBoard[resolvedTargetBoardId] ?? [];
    }
    if (resolvedTargetBoardId === boardId) {
      return listOptions;
    }
    return [];
  }, [boardId, destinationOptions, listOptions, resolvedTargetBoardId]);
  const resolvedTargetListId = useMemo(() => {
    if (listsForTargetBoard.some((list) => list.id === draftState.targetListId)) {
      return draftState.targetListId;
    }
    if (
      resolvedTargetBoardId === boardId &&
      listsForTargetBoard.some((list) => list.id === defaultListId)
    ) {
      return defaultListId;
    }
    return listsForTargetBoard[0]?.id ?? "";
  }, [boardId, defaultListId, draftState.targetListId, listsForTargetBoard, resolvedTargetBoardId]);
  const listCardCountById = useMemo(() => {
    if (!destinationOptions) {
      return new Map<string, number>();
    }

    const counts = new Map<string, number>();
    for (const listOptionsForBoard of Object.values(destinationOptions.listsByBoard)) {
      for (const listOption of listOptionsForBoard) {
        counts.set(listOption.id, listOption.cardCount);
      }
    }
    return counts;
  }, [destinationOptions]);
  const resolvedBoardInfoListCardCount = useMemo(() => {
    const rawCount = listCardCountById.get(resolvedTargetListId);
    if (typeof rawCount !== "number") {
      return undefined;
    }
    if (resolvedTargetBoardId === boardId && resolvedTargetListId === defaultListId) {
      return Math.max(0, rawCount - 1);
    }
    return rawCount;
  }, [boardId, defaultListId, listCardCountById, resolvedTargetBoardId, resolvedTargetListId]);
  const boardInfoPositionOptions = useMemo(
    () => buildDynamicPositionOptions(resolvedBoardInfoListCardCount),
    [resolvedBoardInfoListCardCount],
  );
  const privateInboxPositionCount = Math.max(1, destinationOptions?.privateInboxPositionCount ?? 1);
  const isInboxListEmpty = privateInboxPositionCount <= 1;
  const inboxPositionOptions = useMemo(
    () => Array.from({ length: privateInboxPositionCount }, (_, index) => String(index + 1)),
    [privateInboxPositionCount],
  );
  const inboxPositionValue = useMemo(() => {
    if (!isInboxListEmpty && inboxPosition === LAST_POSITION_VALUE) {
      return inboxPosition;
    }
    if (inboxPositionOptions.includes(inboxPosition)) {
      return inboxPosition;
    }
    return "1";
  }, [inboxPosition, inboxPositionOptions, isInboxListEmpty]);
  const boardInfoTargetPositionIndex = draftState.targetPosition === LAST_POSITION_VALUE
    ? 10000
    : Number.parseInt(draftState.targetPosition, 10);
  const inboxTargetPositionIndex = inboxPositionValue === LAST_POSITION_VALUE
    ? 10000
    : Number.parseInt(inboxPositionValue, 10);

  const moveMutation = useMutation({
    mutationKey: [...modalMutationKey, "move-with-options"],
    mutationFn: async () => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("cardId", cardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("targetBoardId", resolvedTargetBoardId);
      formData.set("targetListId", resolvedTargetListId);
      formData.set("targetPositionIndex", String(boardInfoTargetPositionIndex));
      return moveCardInline(formData);
    },
    onMutate: () => {
      onOpenChange(false);
      if (resolvedTargetBoardId !== boardId) {
        return {};
      }

      const rollback = onOptimisticBoardChange({
        cardId,
        targetListId: resolvedTargetListId,
        targetPositionIndex: boardInfoTargetPositionIndex,
        type: "move-card",
      });
      onOptimisticCardPatch?.({ list_id: resolvedTargetListId });
      return { rollback };
    },
    onError: (_error, _variables, context) => {
      context?.rollback?.();
    },
    onSuccess: (result, _variables, context) => {
      if (!result.ok) {
        context?.rollback?.();
        toast.error(result.error ?? "Không thể di chuyển thẻ.");
        return;
      }

      const movedBoardId = result.movedCard?.boardId ?? resolvedTargetBoardId;
      const movedListId = result.movedCard?.listId ?? resolvedTargetListId;
      toast.success("Đã di chuyển thẻ.");
      invalidateCardRichnessQuery({
        boardId,
        cardId,
        queryClient,
        richnessQueryKey,
        workspaceSlug,
      });

      if (movedBoardId !== boardId) {
        router.push(`${APP_ROUTES.workspace.boardById(workspaceSlug, movedBoardId)}?c=${encodeURIComponent(cardId)}`);
        return;
      }

      onOptimisticCardPatch?.({ list_id: movedListId });
    },
  });
  const inboxMutation = useMutation({
    mutationKey: [...modalMutationKey, "upsert-private-inbox-item"],
    mutationFn: async () => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("cardId", cardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("targetPositionIndex", String(inboxTargetPositionIndex));
      return upsertPrivateInboxItemInline(formData);
    },
    onMutate: () => {
      onOpenChange(false);
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể cập nhật Hộp thư đến.");
        return;
      }

      toast.success("Đã cập nhật Hộp thư đến.");
      invalidateCardRichnessQuery({
        boardId,
        cardId,
        queryClient,
        richnessQueryKey,
        workspaceSlug,
      });
    },
  });

  const destinationQueryError = destinationQuery.data?.ok === false ? destinationQuery.data.error : undefined;
  const isActionPending = moveMutation.isPending || inboxMutation.isPending;
  const isSubmitDisabled =
    !canWrite ||
    isActionPending ||
    (activeTab === "boardInfo" && destinationQuery.isLoading) ||
    (activeTab === "boardInfo" && (resolvedTargetBoardId.length < 1 || resolvedTargetListId.length < 1));

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <button
          aria-label="Quay lại"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-slate-100"
          onClick={() => {
            onOpenChange(false);
          }}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-base font-semibold text-slate-100">Di chuyển thẻ</p>
        <button
          aria-label="Đóng"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-slate-100"
          onClick={() => {
            onOpenChange(false);
          }}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-4 border-b border-white/10 pb-2 text-sm">
        <button
          className={cn(
            "pb-1 transition-colors",
            activeTab === "inbox"
              ? "border-b-2 border-sky-500 font-semibold text-sky-300"
              : "text-slate-400 hover:text-slate-200",
          )}
          onClick={() => {
            setActiveTab("inbox");
          }}
          type="button"
        >
          Hộp thư đến
        </button>
        <button
          className={cn(
            "pb-1 transition-colors",
            activeTab === "boardInfo"
              ? "border-b-2 border-sky-500 font-semibold text-sky-300"
              : "text-slate-400 hover:text-slate-200",
          )}
          onClick={() => {
            setActiveTab("boardInfo");
          }}
          type="button"
        >
          Bảng thông tin
        </button>
      </div>

      {activeTab === "inbox" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-300">Lựa chọn vị trí</p>
            <select
              className="h-10 w-[96px] rounded-md border border-slate-600 bg-[#252a33] px-2 text-sm text-slate-100"
              disabled={!canWrite || isActionPending}
              onChange={(event) => {
                setInboxPosition(event.target.value);
              }}
              value={inboxPositionValue}
            >
              {inboxPositionOptions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
              {isInboxListEmpty ? null : <option value={LAST_POSITION_VALUE}>Cuối</option>}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-sm text-slate-300">Bảng thông tin</p>
            <select
              className="h-10 w-full rounded-md border border-slate-600 bg-[#252a33] px-2 text-sm text-slate-100"
              disabled={!canWrite || isActionPending || boardOptions.length < 1}
              onChange={(event) => {
                const nextBoardId = event.target.value;
                const nextBoardLists = destinationOptions?.listsByBoard[nextBoardId] ?? [];
                setDraftState((previous) => ({
                  ...previous,
                  targetBoardId: nextBoardId,
                  targetListId: nextBoardLists.some((list) => list.id === previous.targetListId)
                    ? previous.targetListId
                    : (nextBoardLists[0]?.id ?? ""),
                  targetPosition: "1",
                }));
              }}
              value={resolvedTargetBoardId}
            >
              {boardOptions.map((boardOption) => (
                <option key={boardOption.id} value={boardOption.id}>
                  {boardOption.name}
                </option>
              ))}
            </select>
            {destinationQueryError ? (
              <p className="text-xs text-amber-300">{destinationQueryError}</p>
            ) : null}
            {destinationQuery.isLoading ? (
              <LoadingInline className="pt-1 text-[11px] text-slate-400" label="Đang tải thêm bảng và danh sách..." />
            ) : null}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
            <div className="space-y-1">
              <p className="text-sm text-slate-300">Danh sách</p>
              <select
                className="h-10 w-full rounded-md border border-slate-600 bg-[#252a33] px-2 text-sm text-slate-100"
                disabled={!canWrite || isActionPending || listsForTargetBoard.length < 1}
                onChange={(event) => {
                  setDraftState((previous) => ({ ...previous, targetListId: event.target.value }));
                }}
                value={resolvedTargetListId}
              >
                {listsForTargetBoard.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title}
                  </option>
                ))}
              </select>
              {resolvedTargetBoardId.length > 0 && listsForTargetBoard.length < 1 ? (
                <p className="text-xs text-amber-300">Bảng đích chưa có danh sách khả dụng.</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-300">Vị trí</p>
              <select
                className="h-10 w-full rounded-md border border-slate-600 bg-[#252a33] px-2 text-sm text-slate-100"
                disabled={!canWrite || isActionPending || listsForTargetBoard.length < 1}
                onChange={(event) => {
                  setDraftState((previous) => ({ ...previous, targetPosition: event.target.value }));
                }}
                value={draftState.targetPosition}
              >
                {boardInfoPositionOptions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
                <option value={LAST_POSITION_VALUE}>Cuối</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="pt-1">
        <Button
          className="h-9 w-full bg-[#579dff] px-4 text-sm font-semibold text-slate-950 hover:bg-[#8fb9ff]"
          disabled={isSubmitDisabled}
          onClick={() => {
            if (activeTab === "inbox") {
              inboxMutation.mutate();
              return;
            }

            moveMutation.mutate();
          }}
          type="button"
        >
          {isActionPending ? "Đang xử lý..." : "Di chuyển"}
        </Button>
      </div>
    </div>
  );
}
