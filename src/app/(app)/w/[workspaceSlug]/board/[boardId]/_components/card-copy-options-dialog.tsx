"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, LoadingInline } from "@/components/ui";
import { APP_ROUTES } from "@/core";
import { cn } from "@/shared";

import { copyCardWithOptionsInline, getCopyDestinationOptionsInline } from "../actions.card-advanced";
import type { CardRecord } from "../types";
import { invalidateCardRichnessQuery } from "./board-mutations/invalidation";
import type { BoardOptimisticChange } from "./board-dnd-helpers";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";

export type CardCopySummary = {
  attachmentCount: number;
  checklistCount: number;
  customFieldCount: number;
  memberCount: number;
};

type CopyDialogDraftState = {
  includeAttachments: boolean;
  includeChecklist: boolean;
  includeCustomFields: boolean;
  includeMembers: boolean;
  targetBoardId: string;
  targetListId: string;
  targetPosition: string;
  title: string;
};
type CopyPanelTab = "boardInfo" | "inbox";

type CardCopyOptionsDialogProps = {
  boardId: string;
  boardName: string;
  canWrite: boolean;
  cardId: string;
  copySummary: CardCopySummary;
  defaultListId: string;
  listOptions: Array<{ id: string; title: string }>;
  onOpenChange: (open: boolean) => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  richnessQueryKey?: readonly [string, string, string, string];
  sourceCard: CardRecord;
  workspaceSlug: string;
};

const LAST_POSITION_VALUE = "last";
const FALLBACK_POSITION_OPTIONS = Array.from({ length: 10 }, (_, index) => String(index + 1));

function buildInitialDraftState(params: {
  boardId: string;
  copySummary: CardCopySummary;
  defaultListId: string;
  sourceTitle: string;
}): CopyDialogDraftState {
  return {
    includeAttachments: params.copySummary.attachmentCount > 0,
    includeChecklist: params.copySummary.checklistCount > 0,
    includeCustomFields: params.copySummary.customFieldCount > 0,
    includeMembers: params.copySummary.memberCount > 0,
    targetBoardId: params.boardId,
    targetListId: params.defaultListId,
    targetPosition: "1",
    title: `Copy of ${params.sourceTitle}`,
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
export function CardCopyOptionsDialog({
  boardId,
  boardName,
  canWrite,
  cardId,
  copySummary,
  defaultListId,
  listOptions,
  onOpenChange,
  onOptimisticBoardChange,
  richnessQueryKey,
  sourceCard,
  workspaceSlug,
}: CardCopyOptionsDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const optimisticCopySequenceRef = useRef(0);
  const [activeTab, setActiveTab] = useState<CopyPanelTab>("boardInfo");
  const [draftState, setDraftState] = useState(() => buildInitialDraftState({
    boardId,
    copySummary,
    defaultListId,
    sourceTitle: sourceCard.title,
  }));
  const [inboxTargetPosition, setInboxTargetPosition] = useState("1");

  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId,
    workspaceSlug,
  });
  const destinationQuery = useQuery({
    enabled: canWrite,
    queryKey: [...modalMutationKey, "copy-destination-options"],
    queryFn: async () => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("cardId", cardId);
      formData.set("workspaceSlug", workspaceSlug);
      return getCopyDestinationOptionsInline(formData);
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
  const resolvedBoardInfoListCardCount = useMemo(
    () => listCardCountById.get(resolvedTargetListId),
    [listCardCountById, resolvedTargetListId],
  );
  const resolvedInboxListCardCount = useMemo(
    () => listCardCountById.get(defaultListId),
    [defaultListId, listCardCountById],
  );
  const boardInfoPositionOptions = useMemo(
    () => buildDynamicPositionOptions(resolvedBoardInfoListCardCount),
    [resolvedBoardInfoListCardCount],
  );
  const inboxPositionOptions = useMemo(
    () => buildDynamicPositionOptions(resolvedInboxListCardCount),
    [resolvedInboxListCardCount],
  );
  const effectiveTargetBoardId = activeTab === "inbox" ? boardId : resolvedTargetBoardId;
  const effectiveTargetListId = activeTab === "inbox" ? defaultListId : resolvedTargetListId;
  const effectiveTargetPositionValue = activeTab === "inbox" ? inboxTargetPosition : draftState.targetPosition;
  const effectiveTargetPositionIndex = effectiveTargetPositionValue === LAST_POSITION_VALUE
    ? 10000
    : Number.parseInt(effectiveTargetPositionValue, 10);

  const mutation = useMutation({
    mutationKey: [...modalMutationKey, "copy-with-options"],
    mutationFn: async () => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("cardId", cardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("title", draftState.title.trim());
      formData.set("targetBoardId", effectiveTargetBoardId);
      formData.set("targetListId", effectiveTargetListId);
      formData.set("targetPositionIndex", String(effectiveTargetPositionIndex));
      formData.set("includeChecklist", draftState.includeChecklist ? "true" : "false");
      formData.set("includeMembers", draftState.includeMembers ? "true" : "false");
      formData.set("includeAttachments", draftState.includeAttachments ? "true" : "false");
      formData.set("includeCustomFields", draftState.includeCustomFields ? "true" : "false");
      return copyCardWithOptionsInline(formData);
    },
    onMutate: () => {
      onOpenChange(false);
      if (effectiveTargetBoardId !== boardId) {
        return {};
      }

      optimisticCopySequenceRef.current += 1;
      const optimisticCardId = `optimistic-copy:${cardId}:${optimisticCopySequenceRef.current}`;
      const rollback = onOptimisticBoardChange({
        copiedCardId: optimisticCardId,
        copiedTitle: draftState.title.trim(),
        includeAttachments: draftState.includeAttachments,
        includeChecklist: draftState.includeChecklist,
        includeCustomFields: draftState.includeCustomFields,
        includeMembers: draftState.includeMembers,
        sourceCard,
        targetListId: effectiveTargetListId,
        targetPositionIndex: effectiveTargetPositionIndex,
        type: "insert-copied-card",
      });
      return { optimisticCardId, rollback };
    },
    onError: (_error, _variables, context) => {
      context?.rollback?.();
    },
    onSuccess: (result, _variables, context) => {
      if (!result.ok) {
        context?.rollback?.();
        toast.error(result.error ?? "Không thể sao chép thẻ.");
        return;
      }

      toast.success("Đã sao chép thẻ.");
      invalidateCardRichnessQuery({
        boardId,
        cardId,
        queryClient,
        richnessQueryKey,
        workspaceSlug,
      });

      if (result.targetBoardId && result.targetBoardId !== boardId) {
        const cardQuery = result.copiedCardId ? `?c=${encodeURIComponent(result.copiedCardId)}` : "";
        router.push(`${APP_ROUTES.workspace.boardById(workspaceSlug, result.targetBoardId)}${cardQuery}`);
        return;
      }

      const copiedCardId = result.copiedCardId?.trim();
      if (context?.optimisticCardId) {
        context?.rollback?.();
      }
      if (copiedCardId) {
        onOptimisticBoardChange({
          copiedCardId,
          copiedTitle: draftState.title.trim(),
          includeAttachments: draftState.includeAttachments,
          includeChecklist: draftState.includeChecklist,
          includeCustomFields: draftState.includeCustomFields,
          includeMembers: draftState.includeMembers,
          sourceCard,
          targetListId: effectiveTargetListId,
          targetPositionIndex: effectiveTargetPositionIndex,
          type: "insert-copied-card",
        });
      }
    },
  });

  const destinationQueryError = destinationQuery.data?.ok === false ? destinationQuery.data.error : undefined;
  const isSubmitDisabled =
    !canWrite ||
    mutation.isPending ||
    (activeTab === "boardInfo" && destinationQuery.isLoading) ||
    draftState.title.trim().length < 1 ||
    effectiveTargetBoardId.length < 1 ||
    effectiveTargetListId.length < 1;

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
        <p className="text-base font-semibold text-slate-100">Sao chép thẻ</p>
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

      <div className="space-y-1">
        <p className="text-sm text-slate-200">Tên</p>
        <textarea
          className="min-h-[62px] w-full rounded-md border border-slate-600 bg-[#252a33] px-3 py-2 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-slate-400"
          onChange={(event) => {
            setDraftState((previous) => ({ ...previous, title: event.target.value }));
          }}
          value={draftState.title}
        />
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-slate-300">Giữ...</p>
        <label className="flex items-center gap-2 text-slate-200">
          <input checked={draftState.includeChecklist} disabled={copySummary.checklistCount < 1} onChange={(event) => {
            setDraftState((previous) => ({ ...previous, includeChecklist: event.target.checked }));
          }} type="checkbox" />
          Danh sách công việc ({copySummary.checklistCount})
        </label>
        <label className="flex items-center gap-2 text-slate-200">
          <input checked={draftState.includeMembers} disabled={copySummary.memberCount < 1} onChange={(event) => {
            setDraftState((previous) => ({ ...previous, includeMembers: event.target.checked }));
          }} type="checkbox" />
          Thành viên ({copySummary.memberCount})
        </label>
        <label className="flex items-center gap-2 text-slate-200">
          <input checked={draftState.includeAttachments} disabled={copySummary.attachmentCount < 1} onChange={(event) => {
            setDraftState((previous) => ({ ...previous, includeAttachments: event.target.checked }));
          }} type="checkbox" />
          Tệp đính kèm ({copySummary.attachmentCount})
        </label>
        <label className="flex items-center gap-2 text-slate-200">
          <input checked={draftState.includeCustomFields} disabled={copySummary.customFieldCount < 1} onChange={(event) => {
            setDraftState((previous) => ({ ...previous, includeCustomFields: event.target.checked }));
          }} type="checkbox" />
          Trường tùy chỉnh ({copySummary.customFieldCount})
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-200">Sao chép tới...</p>
        {activeTab === "inbox" ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-300">Lựa chọn vị trí</p>
            <select
              className="h-10 w-[96px] rounded-md border border-slate-600 bg-[#252a33] px-2 text-sm text-slate-100"
              disabled={!canWrite || mutation.isPending}
              onChange={(event) => {
                setInboxTargetPosition(event.target.value);
              }}
              value={inboxTargetPosition}
            >
              {inboxPositionOptions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
              <option value={LAST_POSITION_VALUE}>Cuối</option>
            </select>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-sm text-slate-300">Bảng thông tin</p>
              <select
                className="h-10 w-full rounded-md border border-slate-600 bg-[#252a33] px-2 text-sm text-slate-100"
                disabled={!canWrite || mutation.isPending || destinationQuery.isLoading || boardOptions.length < 1}
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
                  disabled={!canWrite || mutation.isPending || destinationQuery.isLoading || listsForTargetBoard.length < 1}
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
                  disabled={!canWrite || mutation.isPending || listsForTargetBoard.length < 1}
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
          </>
        )}
      </div>

      <div className="pt-1">
        <Button
          className="h-9 w-full bg-[#579dff] px-4 text-sm font-semibold text-slate-950 hover:bg-[#8fb9ff]"
          disabled={isSubmitDisabled}
          onClick={() => {
            mutation.mutate();
          }}
          type="button"
        >
          {mutation.isPending ? "Đang tạo..." : "Tạo thẻ"}
        </Button>
      </div>
    </div>
  );
}
