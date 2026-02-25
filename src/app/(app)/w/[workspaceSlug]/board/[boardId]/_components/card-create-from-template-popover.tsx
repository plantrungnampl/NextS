"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Popover, PopoverContent, PopoverTrigger, Textarea } from "@/components/ui";

import { copyCardWithOptionsInline } from "../actions.card-advanced";
import type { CardRecord } from "../types";
import { invalidateCardRichnessQuery } from "./board-mutations/invalidation";
import type { BoardOptimisticChange } from "./board-dnd-helpers";

type CardCreateFromTemplatePopoverProps = {
  boardId: string;
  canWrite: boolean;
  card: CardRecord;
  listOptions: Array<{ id: string; title: string }>;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
};

type QuickCreateVariables = {
  targetListId: string;
  title: string;
};

type QuickCreateMutationContext = {
  optimisticCardId: string;
  rollback: () => void;
  title: string;
};

function buildTemplateQuickCreateMutationKey(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}) {
  return ["template-quick-create", params.workspaceSlug, params.boardId, params.cardId] as const;
}

function resolveDefaultListId(params: {
  cardListId: string;
  listOptions: Array<{ id: string; title: string }>;
}): string {
  if (params.listOptions.some((list) => list.id === params.cardListId)) {
    return params.cardListId;
  }

  return params.listOptions[0]?.id ?? "";
}

function buildTemplateCopyFormData(params: {
  boardId: string;
  cardId: string;
  targetListId: string;
  title: string;
  workspaceSlug: string;
}): FormData {
  const formData = new FormData();
  formData.set("boardId", params.boardId);
  formData.set("cardId", params.cardId);
  formData.set("workspaceSlug", params.workspaceSlug);
  formData.set("title", params.title);
  formData.set("targetBoardId", params.boardId);
  formData.set("targetListId", params.targetListId);
  formData.set("targetPositionIndex", "10000");
  formData.set("includeChecklist", "true");
  formData.set("includeMembers", "true");
  formData.set("includeAttachments", "true");
  formData.set("includeCustomFields", "true");
  return formData;
}

function useTemplateQuickCreateMutation(params: {
  boardId: string;
  card: CardRecord;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onSuccess: () => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const optimisticCopySequenceRef = useRef(0);
  const templateQuickCreateMutationKey = buildTemplateQuickCreateMutationKey({
    boardId: params.boardId,
    cardId: params.card.id,
    workspaceSlug: params.workspaceSlug,
  });

  return useMutation<
    Awaited<ReturnType<typeof copyCardWithOptionsInline>>,
    Error,
    QuickCreateVariables,
    QuickCreateMutationContext
  >({
    mutationKey: templateQuickCreateMutationKey,
    mutationFn: async (variables) => {
      return copyCardWithOptionsInline(
        buildTemplateCopyFormData({
          boardId: params.boardId,
          cardId: params.card.id,
          targetListId: variables.targetListId,
          title: variables.title,
          workspaceSlug: params.workspaceSlug,
        }),
      );
    },
    onMutate: (variables) => {
      optimisticCopySequenceRef.current += 1;
      const optimisticCardId = `optimistic-template-copy:${params.card.id}:${optimisticCopySequenceRef.current}`;
      const rollback = params.onOptimisticBoardChange({
        copiedCardId: optimisticCardId,
        copiedTitle: variables.title,
        includeAttachments: true,
        includeChecklist: true,
        includeCustomFields: true,
        includeMembers: true,
        sourceCard: params.card,
        targetListId: variables.targetListId,
        targetPositionIndex: 10000,
        type: "insert-copied-card",
      });

      return { optimisticCardId, rollback, title: variables.title };
    },
    onError: (_error, _variables, context) => {
      context?.rollback?.();
      toast.error("Không thể tạo thẻ từ mẫu.");
    },
    onSuccess: (result, variables, context) => {
      if (!result.ok) {
        context?.rollback?.();
        toast.error(result.error ?? "Không thể tạo thẻ từ mẫu.");
        return;
      }

      invalidateCardRichnessQuery({
        boardId: params.boardId,
        cardId: params.card.id,
        queryClient,
        richnessQueryKey: params.richnessQueryKey,
        workspaceSlug: params.workspaceSlug,
      });

      const copiedCardId = result.copiedCardId?.trim();
      context?.rollback?.();
      if (copiedCardId) {
        params.onOptimisticBoardChange({
          copiedCardId,
          copiedTitle: context?.title ?? variables.title,
          includeAttachments: true,
          includeChecklist: true,
          includeCustomFields: true,
          includeMembers: true,
          sourceCard: params.card,
          targetListId: variables.targetListId,
          targetPositionIndex: 10000,
          type: "insert-copied-card",
        });
      }

      toast.success("Đã tạo thẻ từ mẫu.");
      params.onSuccess();
    },
  });
}

function TemplateQuickCreateForm(props: {
  canWrite: boolean;
  cardId: string;
  isPending: boolean;
  listOptions: Array<{ id: string; title: string }>;
  onClose: () => void;
  onSubmit: () => void;
  onTargetListChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  targetListId: string;
  title: string;
}) {
  const isSubmitDisabled =
    !props.canWrite ||
    props.isPending ||
    props.title.trim().length < 1 ||
    props.targetListId.trim().length < 1;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <p className="text-center text-lg font-semibold text-slate-200">Tạo Thẻ từ Mẫu</p>
        <button
          aria-label="Đóng popup tạo thẻ từ mẫu"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
          onClick={props.onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-200" htmlFor={`template-title-${props.cardId}`}>
          Tên
        </label>
        <Textarea
          className="min-h-[88px] border-slate-600 bg-[#252a33] text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-400"
          disabled={!props.canWrite || props.isPending}
          id={`template-title-${props.cardId}`}
          maxLength={500}
          onChange={(event) => {
            props.onTitleChange(event.target.value);
          }}
          placeholder="Nhập tên thẻ"
          value={props.title}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-200" htmlFor={`template-list-${props.cardId}`}>
          Danh sách
        </label>
        <select
          className="h-10 w-full rounded-md border border-slate-600 bg-[#252a33] px-2 text-sm text-slate-100 outline-none focus:border-slate-400"
          disabled={!props.canWrite || props.isPending || props.listOptions.length < 1}
          id={`template-list-${props.cardId}`}
          onChange={(event) => {
            props.onTargetListChange(event.target.value);
          }}
          value={props.targetListId}
        >
          {props.listOptions.map((list) => (
            <option key={list.id} value={list.id}>
              {list.title}
            </option>
          ))}
        </select>
      </div>

      <Button
        className="h-9 w-full bg-[#579dff] px-4 text-sm font-semibold text-slate-950 hover:bg-[#8fb9ff]"
        disabled={isSubmitDisabled}
        onClick={props.onSubmit}
        type="button"
      >
        {props.isPending ? "Đang tạo..." : "Tạo thẻ"}
      </Button>
    </div>
  );
}

export function CardCreateFromTemplatePopover({
  boardId,
  canWrite,
  card,
  listOptions,
  onOptimisticBoardChange,
  richnessQueryKey,
  workspaceSlug,
}: CardCreateFromTemplatePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [targetListId, setTargetListId] = useState(() =>
    resolveDefaultListId({ cardListId: card.list_id, listOptions }),
  );

  const resetDraft = () => {
    setTitle(card.title);
    setTargetListId(resolveDefaultListId({ cardListId: card.list_id, listOptions }));
  };

  const mutation = useTemplateQuickCreateMutation({
    boardId,
    card,
    onOptimisticBoardChange,
    onSuccess: () => {
      setIsOpen(false);
      resetDraft();
    },
    richnessQueryKey,
    workspaceSlug,
  });

  return (
    <Popover
      onOpenChange={(nextOpen) => {
        if (mutation.isPending) {
          return;
        }

        setIsOpen(nextOpen);
        if (nextOpen) {
          resetDraft();
        }
      }}
      open={isOpen}
    >
      <PopoverTrigger asChild>
        <button
          className="inline-flex h-8 items-center rounded-md bg-[#579dff] px-3 text-xs font-semibold text-slate-950 transition hover:bg-[#8fb9ff] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canWrite}
          type="button"
        >
          Tạo thẻ từ mẫu
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(92vw,360px)] rounded-xl border border-[#4a5160] bg-[#2f343d] p-3 text-slate-100 shadow-2xl"
        sideOffset={8}
      >
        <TemplateQuickCreateForm
          canWrite={canWrite}
          cardId={card.id}
          isPending={mutation.isPending}
          listOptions={listOptions}
          onClose={() => {
            if (mutation.isPending) {
              return;
            }
            setIsOpen(false);
          }}
          onSubmit={() => {
            const trimmedTitle = title.trim();
            if (trimmedTitle.length < 1) {
              toast.error("Tên thẻ không được để trống.");
              return;
            }
            if (targetListId.trim().length < 1) {
              toast.error("Vui lòng chọn danh sách.");
              return;
            }

            mutation.mutate({
              targetListId,
              title: trimmedTitle,
            });
          }}
          onTargetListChange={setTargetListId}
          onTitleChange={setTitle}
          targetListId={targetListId}
          title={title}
        />
      </PopoverContent>
    </Popover>
  );
}
