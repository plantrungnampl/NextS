"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Copy, MoveRight, Star, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui";

import { deleteCardInline, moveCardInline } from "../actions.card-modal";
import { copyCardInline } from "../actions.card-advanced";
import { archiveCardInline } from "../actions.forms";
import type { CardRecord } from "../types";
import { invalidateCardRichnessQuery } from "./board-mutations/invalidation";
import type { BoardOptimisticChange } from "./board-dnd-helpers";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";
import { useCardWatchOptimisticToggle } from "./card-watch-optimistic";
import { CardDueDateSection } from "./card-richness-due-date-section";
import type { CardCustomFieldsOptimisticPatch } from "./card-richness-modern-ui";

type SidebarActionsProps = {
  boardId: string;
  canWrite: boolean;
  card: CardRecord;
  listOptions: Array<{ id: string; title: string }>;
  onCloseAfterDestructive?: () => void;
  onOptimisticBoardChange?: (change: BoardOptimisticChange) => () => void;
  onOptimisticCardPatch?: (patch: CardCustomFieldsOptimisticPatch) => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
};

type ConfirmActionDialogProps = {
  confirmButtonClassName: string;
  confirmDisabled?: boolean;
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  title: string;
  trigger: ReactNode;
  triggerClassName: string;
};

function invalidateRichnessQuery(params: {
  boardId: string;
  cardId: string;
  queryClient: ReturnType<typeof useQueryClient>;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
}) {
  invalidateCardRichnessQuery(params);
}

function ConfirmActionDialog({
  confirmButtonClassName,
  confirmDisabled,
  confirmLabel,
  description,
  onConfirm,
  title,
  trigger,
  triggerClassName,
}: ConfirmActionDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button className={triggerClassName} onClick={() => setOpen(true)} type="button" variant="secondary">
        {trigger}
      </Button>
      <DialogContent className="w-[min(92vw,480px)] border border-slate-700/80 bg-[#1d2535] text-slate-100">
        <DialogTitle className="text-base font-semibold text-slate-100">{title}</DialogTitle>
        <DialogDescription className="text-sm text-slate-300">{description}</DialogDescription>
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            className="h-9 border-slate-600 bg-slate-800 px-3 text-slate-100 hover:bg-slate-700"
            onClick={() => {
              setOpen(false);
            }}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            className={confirmButtonClassName}
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
            type="button"
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line max-lines-per-function
export function SidebarActions({
  boardId,
  canWrite,
  card,
  listOptions,
  onCloseAfterDestructive,
  onOptimisticBoardChange = () => () => {},
  onOptimisticCardPatch,
  richnessQueryKey,
  workspaceSlug,
}: SidebarActionsProps) {
  const queryClient = useQueryClient();
  const invalidateRichness = () => invalidateRichnessQuery({
    boardId,
    cardId: card.id,
    queryClient,
    richnessQueryKey,
    workspaceSlug,
  });
  const [selectedListId, setSelectedListId] = useState(card.list_id);
  const copySequenceRef = useRef(0);
  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId: card.id,
    workspaceSlug,
  });
  const effectiveSelectedListId = useMemo(() => {
    if (listOptions.some((list) => list.id === selectedListId)) {
      return selectedListId;
    }
    if (listOptions.some((list) => list.id === card.list_id)) {
      return card.list_id;
    }

    return listOptions[0]?.id ?? "";
  }, [card.list_id, listOptions, selectedListId]);
  const { toggleWatch } = useCardWatchOptimisticToggle({
    boardId,
    canWrite,
    card,
    mutationKeySuffix: "sidebar-watch",
    onOptimisticCardPatch,
    richnessQueryKey,
    workspaceSlug,
  });

  const moveMutation = useMutation({
    mutationKey: [...modalMutationKey, "move"],
    mutationFn: async (listId: string) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", card.id);
      formData.set("listId", listId);
      return moveCardInline(formData);
    },
    onMutate: (listId) => {
      const rollback = onOptimisticBoardChange({
        cardId: card.id,
        targetListId: listId,
        targetPositionIndex: 10000,
        type: "move-card",
      });
      onOptimisticCardPatch?.({ list_id: listId } as CardCustomFieldsOptimisticPatch);
      return { rollback };
    },
    onError: (_error, _listId, context) => {
      context?.rollback?.();
    },
    onSuccess: (result, listId, context) => {
      if (!result.ok) {
        context?.rollback?.();
        toast.error(result.error ?? "Không thể chuyển thẻ.");
        return;
      }

      onOptimisticCardPatch?.({ list_id: listId } as CardCustomFieldsOptimisticPatch);
      invalidateRichness();
    },
  });
  const copyMutation = useMutation({
    mutationKey: [...modalMutationKey, "copy"],
    mutationFn: async () => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", card.id);
      return copyCardInline(formData);
    },
    onMutate: () => {
      copySequenceRef.current += 1;
      const optimisticCardId = `optimistic-copy:${card.id}:${copySequenceRef.current}`;
      const rollback = onOptimisticBoardChange({
        copiedCardId: optimisticCardId,
        includeAttachments: true,
        includeChecklist: true,
        includeCustomFields: true,
        includeMembers: true,
        sourceCard: card,
        targetListId: card.list_id,
        targetPositionIndex: 10000,
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
      invalidateRichness();

      if (context?.optimisticCardId) {
        context?.rollback?.();
      }
      if (result.copiedCardId) {
        onOptimisticBoardChange({
          copiedCardId: result.copiedCardId,
          includeAttachments: true,
          includeChecklist: true,
          includeCustomFields: true,
          includeMembers: true,
          sourceCard: card,
          targetListId: card.list_id,
          targetPositionIndex: 10000,
          type: "insert-copied-card",
        });
      }
    },
  });
  const archiveMutation = useMutation({
    mutationKey: [...modalMutationKey, "archive"],
    mutationFn: async () => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", card.id);
      return archiveCardInline(formData);
    },
    onMutate: () => {
      onCloseAfterDestructive?.();
      const rollback = onOptimisticBoardChange({
        cardId: card.id,
        type: "remove-card",
      });
      return { rollback };
    },
    onError: (_error, _variables, context) => {
      context?.rollback?.();
    },
    onSuccess: (result, _variables, context) => {
      if (!result.ok) {
        context?.rollback?.();
        toast.error(result.error ?? "Không thể archive thẻ.");
        return;
      }

      toast.success("Đã archive thẻ.");
      invalidateRichness();
    },
  });
  const deleteMutation = useMutation({
    mutationKey: [...modalMutationKey, "delete"],
    mutationFn: async () => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", card.id);
      return deleteCardInline(formData);
    },
    onMutate: () => {
      onCloseAfterDestructive?.();
      const rollback = onOptimisticBoardChange({
        cardId: card.id,
        type: "remove-card",
      });
      return { rollback };
    },
    onError: (_error, _variables, context) => {
      context?.rollback?.();
    },
    onSuccess: (result, _variables, context) => {
      if (!result.ok) {
        context?.rollback?.();
        toast.error(result.error ?? "Không thể xóa thẻ.");
        return;
      }

      toast.success("Đã xóa thẻ.");
      invalidateRichness();
    },
  });

  const isMutating =
    archiveMutation.isPending ||
    copyMutation.isPending ||
    deleteMutation.isPending ||
    moveMutation.isPending;

  return (
    <section className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-950/35 p-3">
      <CardDueDateSection
        boardId={boardId}
        canWrite={canWrite}
        card={card}
        onOptimisticCardPatch={onOptimisticCardPatch}
        richnessQueryKey={richnessQueryKey}
        workspaceSlug={workspaceSlug}
      />

      <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/30 p-2.5">
        <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
          <MoveRight className="h-3.5 w-3.5" />
          Move to
        </p>
        {canWrite ? (
          <div className="space-y-2">
            <select
              className="h-9 w-full rounded-md border border-slate-600 bg-[#11161d] px-2 text-xs text-slate-100"
              disabled={isMutating}
              onChange={(event) => {
                setSelectedListId(event.target.value);
              }}
              value={effectiveSelectedListId}
            >
              {listOptions.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
            <button
              className="min-h-8 w-full rounded-md bg-[#0c66e4] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0055cc] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={effectiveSelectedListId.length < 1 || isMutating}
              onClick={() => {
                if (!canWrite || effectiveSelectedListId.length < 1) {
                  return;
                }
                moveMutation.mutate(effectiveSelectedListId);
              }}
              type="button"
            >
              <span className="inline-flex items-center gap-1.5">
                <MoveRight className="h-3.5 w-3.5" />
                {moveMutation.isPending ? "Moving card..." : "Move card"}
              </span>
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">Read-only mode: card move is disabled.</p>
        )}
      </div>

      {canWrite ? (
        <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/30 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Actions</p>

          <button
            className="min-h-8 w-full rounded-md border border-slate-600 bg-slate-900/60 px-2 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isMutating}
            onClick={() => {
              copyMutation.mutate();
            }}
            type="button"
          >
            <span className="inline-flex items-center gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              {copyMutation.isPending ? "Copying card..." : "Copy card"}
            </span>
          </button>

          <button
            className="min-h-8 w-full rounded-md border border-slate-600 bg-slate-900/60 px-2 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isMutating}
            onClick={() => {
              toggleWatch();
            }}
            type="button"
          >
            <span className="inline-flex items-center gap-1.5">
              <Star className={`h-3.5 w-3.5 ${card.watchedByViewer ? "fill-current text-amber-300" : "text-slate-300"}`} />
              {card.watchedByViewer ? "Watching" : "Watch card"}
              <span className="text-[11px] text-slate-400">({card.watchCount ?? 0})</span>
            </span>
          </button>

          <ConfirmActionDialog
            confirmButtonClassName="h-9 border border-amber-600 bg-amber-900/40 px-3 text-amber-100 hover:bg-amber-900/55"
            confirmDisabled={isMutating}
            confirmLabel={archiveMutation.isPending ? "Archiving..." : "Archive card"}
            description="This will hide the card from the board. You can restore it from archived cards later."
            onConfirm={() => {
              archiveMutation.mutate();
            }}
            title="Archive this card?"
            trigger={
              <span className="inline-flex items-center gap-1.5">
                <Archive className="h-3.5 w-3.5" />
                Archive
              </span>
            }
            triggerClassName="min-h-8 w-full !border-amber-600 !bg-amber-900/30 px-2 !text-amber-100 hover:!bg-amber-900/45"
          />

          <ConfirmActionDialog
            confirmButtonClassName="h-9 border border-rose-700 bg-rose-900/45 px-3 text-rose-100 hover:bg-rose-900/60"
            confirmDisabled={isMutating}
            confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete card"}
            description="This action is permanent. Card details, comments, attachments, and checklist items will be deleted."
            onConfirm={() => {
              deleteMutation.mutate();
            }}
            title="Delete this card permanently?"
            trigger={
              <span className="inline-flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </span>
            }
            triggerClassName="min-h-8 w-full !border-rose-700 !bg-rose-900/35 px-2 !text-rose-100 hover:!bg-rose-900/55"
          />
        </div>
      ) : null}
    </section>
  );
}
