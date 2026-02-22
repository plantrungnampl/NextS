"use client";
/* eslint-disable max-lines */

import { DndContext, type DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, ListChecks, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui";

import {
  createChecklistItemInline,
  deleteChecklistInline,
  deleteChecklistItemInline,
  reorderChecklistItemsInline,
  reorderChecklistsInline,
  toggleChecklistItemInline,
  updateChecklistInline,
  updateChecklistItemInline,
} from "../actions.card-richness";
import type { ChecklistItemRecord, ChecklistRecord } from "../types";
import type { CardChecklistQueryData } from "./card-richness-loader";

type ChecklistMutationResult =
  | { error: string; ok: false }
  | {
      checklistCompletedCount: number;
      checklistTotalCount: number;
      checklists: ChecklistRecord[];
      ok: true;
    };

export const CHECKLIST_TOGGLE_MUTATION_KEY = "card-richness-checklist-toggle";

export function buildChecklistToggleMutationKey(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}) {
  return [CHECKLIST_TOGGLE_MUTATION_KEY, params.workspaceSlug, params.boardId, params.cardId] as const;
}

function applyChecklistMutationSuccess(params: {
  checklists: ChecklistRecord[];
  checklistQueryKey: readonly [string, string, string, string];
  queryClient: QueryClient;
}) {
  params.queryClient.setQueryData<CardChecklistQueryData>(params.checklistQueryKey, () => ({
    checklists: params.checklists,
  }));
  void params.queryClient.invalidateQueries({ queryKey: params.checklistQueryKey });
}

function withChecklistItemDone(params: {
  data: CardChecklistQueryData | undefined;
  isDone: boolean;
  itemId: string;
}): CardChecklistQueryData | undefined {
  if (!params.data) {
    return params.data;
  }

  let hasChanged = false;
  const checklists = params.data.checklists.map((checklist) => {
    let checklistChanged = false;
    const items = checklist.items.map((item) => {
      if (item.id !== params.itemId) {
        return item;
      }
      if (item.isDone === params.isDone) {
        return item;
      }

      hasChanged = true;
      checklistChanged = true;
      return { ...item, isDone: params.isDone };
    });

    if (!checklistChanged) {
      return checklist;
    }

    return { ...checklist, items };
  });

  if (!hasChanged) {
    return params.data;
  }

  return { checklists };
}

function toFormData(entries: Array<[string, string]>): FormData {
  const formData = new FormData();
  for (const [key, value] of entries) {
    formData.set(key, value);
  }

  return formData;
}

function SortableChecklistRow({
  canWrite,
  isBusy,
  item,
  onDelete,
  onRename,
  onToggle,
}: {
  canWrite: boolean;
  isBusy: boolean;
  item: ChecklistItemRecord;
  onDelete: (itemId: string) => void;
  onRename: (itemId: string, nextBody: string) => void;
  onToggle: (itemId: string, isDone: boolean) => void;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    disabled: isBusy || !canWrite,
    id: item.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      className={`flex items-center gap-2 rounded-md border border-slate-700/80 bg-[#0f1318] px-2 py-2 ${isDragging ? "opacity-70 shadow-md" : ""}`}
      ref={setNodeRef}
      style={style}
    >
      <button
        aria-label="Drag checklist item"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isBusy || !canWrite}
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <input
        checked={item.isDone}
        className="h-4 w-4 shrink-0 accent-cyan-400"
        disabled={!canWrite}
        onChange={(event) => {
          onToggle(item.id, event.target.checked);
        }}
        type="checkbox"
      />
      <input
        className={`h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/70 ${item.isDone ? "text-slate-400 line-through" : ""}`}
        defaultValue={item.body}
        disabled={isBusy || !canWrite}
        key={`${item.id}-${item.body}`}
        onBlur={(event) => {
          const nextBody = event.target.value.trim();
          if (nextBody.length < 1 || nextBody === item.body) {
            event.target.value = item.body;
            return;
          }

          onRename(item.id, nextBody);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        type="text"
      />
      <button
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-900/30 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isBusy || !canWrite}
        onClick={() => {
          onDelete(item.id);
        }}
        type="button"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function useChecklistMutationController(params: {
  checklistQueryKey: readonly [string, string, string, string];
}) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  const withMutation = (
    run: () => Promise<ChecklistMutationResult>,
    options?: { onError?: () => void },
  ) => {
    startTransition(() => {
      void (async () => {
        try {
          const result = await run();
          if (!result.ok) {
            toast.error(result.error);
            options?.onError?.();
            return;
          }

          applyChecklistMutationSuccess({
            checklists: result.checklists,
            checklistQueryKey: params.checklistQueryKey,
            queryClient,
          });
        } catch {
          toast.error("Không thể đồng bộ checklist.");
          options?.onError?.();
        }
      })();
    });
  };

  return { isPending, withMutation };
}

function ChecklistAddItemInput({
  canWrite,
  isPending,
  onCreate,
}: {
  canWrite: boolean;
  isPending: boolean;
  onCreate: (body: string) => void;
}) {
  const [newItemBody, setNewItemBody] = useState("");

  if (!canWrite) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="h-9 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70 focus:ring-1 focus:ring-cyan-300/60"
        disabled={isPending}
        onChange={(event) => {
          setNewItemBody(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }

          event.preventDefault();
          const body = newItemBody.trim();
          if (body.length < 1) {
            return;
          }

          onCreate(body);
          setNewItemBody("");
        }}
        placeholder="Add checklist item..."
        type="text"
        value={newItemBody}
      />
      <Button
        className="h-9 shrink-0 bg-[#0c66e4] px-3 text-white hover:bg-[#0055cc]"
        disabled={isPending || newItemBody.trim().length < 1}
        onClick={() => {
          const body = newItemBody.trim();
          if (body.length < 1) {
            return;
          }

          onCreate(body);
          setNewItemBody("");
        }}
        type="button"
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add item
      </Button>
    </div>
  );
}

function ChecklistItemsSortableList({
  canWrite,
  isPending,
  items,
  onDelete,
  onDragEnd,
  onRename,
  onToggle,
}: {
  canWrite: boolean;
  isPending: boolean;
  items: ChecklistItemRecord[];
  onDelete: (itemId: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onRename: (itemId: string, nextBody: string) => void;
  onToggle: (itemId: string, isDone: boolean) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (items.length === 0) {
    return <p className="text-xs text-slate-400">No checklist item yet.</p>;
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd} sensors={sensors}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item) => (
            <SortableChecklistRow
              canWrite={canWrite}
              isBusy={isPending}
              item={item}
              key={`${item.id}:${item.body}:${item.isDone}`}
              onDelete={onDelete}
              onRename={onRename}
              onToggle={onToggle}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function createChecklistItemDragEndHandler(params: {
  boardId: string;
  canWrite: boolean;
  checklistId: string;
  items: ChecklistItemRecord[];
  withMutation: (
    run: () => Promise<ChecklistMutationResult>,
    options?: { onError?: () => void },
  ) => void;
  workspaceSlug: string;
}) {
  return (event: DragEndEvent) => {
    if (!params.canWrite || !event.over || event.active.id === event.over.id) {
      return;
    }

    const fromIndex = params.items.findIndex((item) => item.id === event.active.id);
    const toIndex = params.items.findIndex((item) => item.id === event.over?.id);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    const orderedItemIds = arrayMove(
      params.items.map((item) => item.id),
      fromIndex,
      toIndex,
    );
    params.withMutation(async () => {
      return reorderChecklistItemsInline(
        toFormData([
          ["boardId", params.boardId],
          ["checklistId", params.checklistId],
          ["orderedItemIds", JSON.stringify(orderedItemIds)],
          ["workspaceSlug", params.workspaceSlug],
        ]),
      );
    });
  };
}

// eslint-disable-next-line max-lines-per-function
function ChecklistGroup({
  boardId,
  canWrite,
  checklist,
  canMoveDown,
  canMoveUp,
  checklistQueryKey,
  isPending,
  onMoveDown,
  onMoveUp,
  toggleMutationKey,
  withMutation,
  workspaceSlug,
}: {
  boardId: string;
  canWrite: boolean;
  canMoveDown: boolean;
  canMoveUp: boolean;
  checklistQueryKey: readonly [string, string, string, string];
  checklist: ChecklistRecord;
  isPending: boolean;
  onMoveDown: () => void;
  onMoveUp: () => void;
  toggleMutationKey: readonly [string, string, string, string];
  withMutation: (
    run: () => Promise<ChecklistMutationResult>,
    options?: { onError?: () => void },
  ) => void;
  workspaceSlug: string;
}) {
  const [optimisticDoneByItemId, setOptimisticDoneByItemId] = useState<Record<string, boolean>>({});
  const toggleRequestIdRef = useRef<Record<string, number>>({});
  const queryClient = useQueryClient();
  const toggleChecklistItemMutation = useMutation({
    mutationKey: toggleMutationKey,
    mutationFn: async (variables: { isDone: boolean; itemId: string }) => {
      return toggleChecklistItemInline(
        toFormData([
          ["boardId", boardId],
          ["checklistItemId", variables.itemId],
          ["isDone", String(variables.isDone)],
          ["workspaceSlug", workspaceSlug],
        ]),
      );
    },
  });

  const sortedItems = useMemo(
    () =>
      [...checklist.items]
        .map((item) => {
          const optimisticDone = optimisticDoneByItemId[item.id];
          if (typeof optimisticDone !== "boolean") {
            return item;
          }
          return { ...item, isDone: optimisticDone };
        })
        .sort((left, right) => left.position - right.position),
    [checklist.items, optimisticDoneByItemId],
  );
  const completedCount = sortedItems.filter((item) => item.isDone).length;
  const totalCount = sortedItems.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const handleItemDragEnd = createChecklistItemDragEndHandler({
    boardId,
    canWrite,
    checklistId: checklist.id,
    items: sortedItems,
    withMutation,
    workspaceSlug,
  });

  return (
    <div className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-950/35 p-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-slate-100 outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/60"
            defaultValue={checklist.title}
            disabled={!canWrite || isPending}
            key={`${checklist.id}:${checklist.title}`}
            onBlur={(event) => {
              const nextTitle = event.target.value.trim();
              if (nextTitle.length < 1 || nextTitle === checklist.title) {
                event.target.value = checklist.title;
                return;
              }

              withMutation(async () => {
                return updateChecklistInline(
                  toFormData([
                    ["boardId", boardId],
                    ["checklistId", checklist.id],
                    ["title", nextTitle],
                    ["workspaceSlug", workspaceSlug],
                  ]),
                );
              });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            type="text"
          />
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
            <ListChecks className="h-3 w-3" />
            {completedCount}/{totalCount}
          </span>
          {canWrite ? (
            <div className="flex items-center gap-1">
              <button
                aria-label="Move checklist up"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isPending || !canMoveUp}
                onClick={onMoveUp}
                type="button"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                aria-label="Move checklist down"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isPending || !canMoveDown}
                onClick={onMoveDown}
                type="button"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-900/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPending}
                onClick={() => {
                  withMutation(async () => {
                    return deleteChecklistInline(
                      toFormData([
                        ["boardId", boardId],
                        ["checklistId", checklist.id],
                        ["workspaceSlug", workspaceSlug],
                      ]),
                    );
                  });
                }}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-cyan-400 transition-all duration-200" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      <ChecklistAddItemInput
        canWrite={canWrite}
        isPending={isPending}
        onCreate={(body) => {
          withMutation(async () => {
            return createChecklistItemInline(
              toFormData([
                ["boardId", boardId],
                ["body", body],
                ["checklistId", checklist.id],
                ["workspaceSlug", workspaceSlug],
              ]),
            );
          });
        }}
      />

      <ChecklistItemsSortableList
        canWrite={canWrite}
        isPending={isPending}
        items={sortedItems}
        onDelete={(itemId) => {
          withMutation(async () => {
            return deleteChecklistItemInline(
              toFormData([
                ["boardId", boardId],
                ["checklistItemId", itemId],
                ["workspaceSlug", workspaceSlug],
              ]),
            );
          });
        }}
        onDragEnd={handleItemDragEnd}
        onRename={(itemId, nextBody) => {
          withMutation(async () => {
            return updateChecklistItemInline(
              toFormData([
                ["boardId", boardId],
                ["body", nextBody],
                ["checklistItemId", itemId],
                ["workspaceSlug", workspaceSlug],
              ]),
            );
          });
        }}
        onToggle={(itemId, isDone) => {
          const previousDone = sortedItems.find((item) => item.id === itemId)?.isDone ?? false;
          const previousChecklistData = queryClient.getQueryData<CardChecklistQueryData>(checklistQueryKey);
          setOptimisticDoneByItemId((prev) => ({ ...prev, [itemId]: isDone }));
          queryClient.setQueryData<CardChecklistQueryData>(checklistQueryKey, (current) =>
            withChecklistItemDone({ data: current, isDone, itemId }),
          );
          const requestId = (toggleRequestIdRef.current[itemId] ?? 0) + 1;
          toggleRequestIdRef.current[itemId] = requestId;
          toggleChecklistItemMutation.mutate(
            { isDone, itemId },
            {
              onError: () => {
                const isStale = (toggleRequestIdRef.current[itemId] ?? 0) !== requestId;
                if (isStale) {
                  return;
                }

                toast.error("Không thể cập nhật checklist.");
                setOptimisticDoneByItemId((prev) => ({ ...prev, [itemId]: previousDone }));
                if (previousChecklistData) {
                  queryClient.setQueryData<CardChecklistQueryData>(checklistQueryKey, previousChecklistData);
                } else {
                  void queryClient.invalidateQueries({ queryKey: checklistQueryKey });
                }
              },
              onSuccess: async (result) => {
                const isStale = (toggleRequestIdRef.current[itemId] ?? 0) !== requestId;
                if (isStale) {
                  return;
                }

                if (!result.ok) {
                  toast.error(result.error);
                  setOptimisticDoneByItemId((prev) => ({ ...prev, [itemId]: previousDone }));
                  if (previousChecklistData) {
                    queryClient.setQueryData<CardChecklistQueryData>(checklistQueryKey, previousChecklistData);
                  } else {
                    void queryClient.invalidateQueries({ queryKey: checklistQueryKey });
                  }
                  return;
                }

                applyChecklistMutationSuccess({
                  checklists: result.checklists,
                  checklistQueryKey,
                  queryClient,
                });
              },
              onSettled: () => {
                void queryClient.invalidateQueries({ queryKey: checklistQueryKey });
              },
            },
          );
        }}
      />
    </div>
  );
}

export function CardRichnessChecklistSection({
  boardId,
  cardId: cardIdFromProps,
  canWrite,
  checklistQueryKey,
  checklists,
  workspaceSlug,
}: {
  boardId: string;
  cardId: string;
  canWrite: boolean;
  checklistQueryKey: readonly [string, string, string, string];
  checklists: ChecklistRecord[];
  workspaceSlug: string;
}) {
  const { isPending, withMutation } = useChecklistMutationController({
    checklistQueryKey,
  });
  const sortedChecklists = useMemo(
    () => [...checklists].sort((left, right) => left.position - right.position),
    [checklists],
  );
  const checklistIds = sortedChecklists.map((entry) => entry.id);
  const totalItems = sortedChecklists.reduce((sum, checklist) => sum + checklist.items.length, 0);
  const completedItems = sortedChecklists.reduce(
    (sum, checklist) => sum + checklist.items.filter((item) => item.isDone).length,
    0,
  );
  const toggleMutationKey = buildChecklistToggleMutationKey({
    boardId,
    cardId: cardIdFromProps,
    workspaceSlug,
  });

  return (
    <section className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-950/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Checklist</p>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
          <ListChecks className="h-3 w-3" />
          {completedItems}/{totalItems}
        </span>
      </div>

      {sortedChecklists.length > 0 ? (
        <div className="space-y-3">
          {sortedChecklists.map((checklist, index) => (
            <ChecklistGroup
              boardId={boardId}
              canWrite={canWrite}
              canMoveDown={index < sortedChecklists.length - 1}
              canMoveUp={index > 0}
              checklistQueryKey={checklistQueryKey}
              checklist={checklist}
              isPending={isPending}
              key={checklist.id}
              onMoveDown={() => {
                if (index >= checklistIds.length - 1) {
                  return;
                }

                const reorderedIds = arrayMove(checklistIds, index, index + 1);
                withMutation(async () => {
                  return reorderChecklistsInline(
                    toFormData([
                      ["boardId", boardId],
                      ["cardId", cardIdFromProps],
                      ["orderedChecklistIds", JSON.stringify(reorderedIds)],
                      ["workspaceSlug", workspaceSlug],
                    ]),
                  );
                });
              }}
              onMoveUp={() => {
                if (index <= 0) {
                  return;
                }

                const reorderedIds = arrayMove(checklistIds, index, index - 1);
                withMutation(async () => {
                  return reorderChecklistsInline(
                    toFormData([
                      ["boardId", boardId],
                      ["cardId", cardIdFromProps],
                      ["orderedChecklistIds", JSON.stringify(reorderedIds)],
                      ["workspaceSlug", workspaceSlug],
                    ]),
                  );
                });
              }}
              toggleMutationKey={toggleMutationKey}
              withMutation={withMutation}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
          Chưa có checklist. Vào <span className="font-semibold">+ Thêm → Việc cần làm</span> để tạo checklist mới.
        </p>
      )}
    </section>
  );
}
