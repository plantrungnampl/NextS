"use client";
/* eslint-disable max-lines */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage, Input, Label } from "@/components/ui";

import {
  addCardLabelInline,
  assignCardMemberInline,
  createWorkspaceLabelAndAttachInline,
  createWorkspaceLabelInline,
  deleteWorkspaceLabelInline,
  removeCardLabelInline,
  unassignCardMemberInline,
  updateWorkspaceLabelInline,
} from "../actions.card-richness";
import type {
  LabelRecord,
  WorkspaceMemberRecord,
} from "../types";
import { invalidateCardRichnessQuery } from "./board-mutations/invalidation";
import { getInitials } from "./card-ui-utils";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";

export function HiddenBoardInputs({
  boardId,
  workspaceSlug,
}: {
  boardId: string;
  workspaceSlug: string;
}) {
  return (
    <>
      <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
      <input name="boardId" type="hidden" value={boardId} />
    </>
  );
}

function invalidateRichnessQuery(params: {
  boardId: string;
  cardId: string;
  queryClient: ReturnType<typeof useQueryClient>;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
}) {
  invalidateCardRichnessQuery(params);
}

function LabelBadge({ label }: { label: LabelRecord }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ backgroundColor: label.color }}
      title={label.name}
    >
      {label.name}
    </span>
  );
}

// eslint-disable-next-line max-lines-per-function
export function LabelsSection({
  boardId,
  canManageLabels,
  canWrite,
  cardId,
  labels,
  onOptimisticCardPatch,
  richnessQueryKey,
  workspaceLabels,
  workspaceSlug,
}: {
  boardId: string;
  canManageLabels: boolean;
  canWrite: boolean;
  cardId: string;
  labels: LabelRecord[];
  onOptimisticCardPatch?: (patch: { labels: LabelRecord[] }) => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceLabels: LabelRecord[];
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const invalidateRichness = () => invalidateRichnessQuery({
    boardId,
    cardId,
    queryClient,
    richnessQueryKey,
    workspaceSlug,
  });
  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId,
    workspaceSlug,
  });
  const [localWorkspaceLabels, setLocalWorkspaceLabels] = useState<LabelRecord[]>(workspaceLabels);
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const [quickCreateName, setQuickCreateName] = useState("");
  const [quickCreateColor, setQuickCreateColor] = useState("#0C66E4");
  const [managerCreateName, setManagerCreateName] = useState("");
  const [managerCreateColor, setManagerCreateColor] = useState("#0C66E4");

  const addLabelMutation = useMutation({
    mutationKey: [...modalMutationKey, "labels-add"],
    mutationFn: async (labelId: string) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", cardId);
      formData.set("labelId", labelId);
      return addCardLabelInline(formData);
    },
    onSuccess: (result, labelId) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể thêm nhãn.");
        return;
      }

      const labelToAdd = localWorkspaceLabels.find((label) => label.id === labelId);
      if (labelToAdd && !labels.some((label) => label.id === labelToAdd.id)) {
        onOptimisticCardPatch?.({ labels: [...labels, labelToAdd] });
      }
      invalidateRichness();
    },
  });
  const removeLabelMutation = useMutation({
    mutationKey: [...modalMutationKey, "labels-remove"],
    mutationFn: async (labelId: string) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", cardId);
      formData.set("labelId", labelId);
      return removeCardLabelInline(formData);
    },
    onSuccess: (result, labelId) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể gỡ nhãn.");
        return;
      }

      onOptimisticCardPatch?.({ labels: labels.filter((label) => label.id !== labelId) });
      invalidateRichness();
    },
  });
  const quickCreateAndAttachMutation = useMutation({
    mutationKey: [...modalMutationKey, "labels-quick-create-attach"],
    mutationFn: async (payload: { color: string; name: string }) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", cardId);
      formData.set("name", payload.name);
      formData.set("color", payload.color);
      return createWorkspaceLabelAndAttachInline(formData);
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể tạo nhãn.");
        return;
      }

      setQuickCreateName("");
      setLocalWorkspaceLabels((previous) => {
        if (previous.some((label) => label.id === result.label.id)) {
          return previous;
        }
        return [...previous, result.label];
      });
      onOptimisticCardPatch?.({
        labels: labels.some((label) => label.id === result.label.id)
          ? labels
          : [...labels, result.label],
      });
      invalidateRichness();
    },
  });
  const createWorkspaceLabelMutation = useMutation({
    mutationKey: [...modalMutationKey, "labels-create-workspace"],
    mutationFn: async (payload: { color: string; name: string }) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("name", payload.name);
      formData.set("color", payload.color);
      return createWorkspaceLabelInline(formData);
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể tạo nhãn workspace.");
        return;
      }

      setManagerCreateName("");
      setLocalWorkspaceLabels((previous) => {
        if (previous.some((label) => label.id === result.label.id)) {
          return previous;
        }
        return [...previous, result.label];
      });
      invalidateRichness();
    },
  });
  const updateWorkspaceLabelMutation = useMutation({
    mutationKey: [...modalMutationKey, "labels-update-workspace"],
    mutationFn: async (payload: { color: string; labelId: string; name: string }) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("labelId", payload.labelId);
      formData.set("name", payload.name);
      formData.set("color", payload.color);
      return updateWorkspaceLabelInline(formData);
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể cập nhật nhãn.");
        return;
      }

      setLocalWorkspaceLabels((previous) =>
        previous.map((label) => (label.id === result.label.id ? result.label : label)),
      );
      if (labels.some((label) => label.id === result.label.id)) {
        onOptimisticCardPatch?.({
          labels: labels.map((label) => (label.id === result.label.id ? result.label : label)),
        });
      }
      invalidateRichness();
    },
  });
  const deleteWorkspaceLabelMutation = useMutation({
    mutationKey: [...modalMutationKey, "labels-delete-workspace"],
    mutationFn: async (labelId: string) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("labelId", labelId);
      return deleteWorkspaceLabelInline(formData);
    },
    onSuccess: (result, labelId) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể xóa nhãn.");
        return;
      }

      setLocalWorkspaceLabels((previous) => previous.filter((label) => label.id !== labelId));
      onOptimisticCardPatch?.({
        labels: labels.filter((label) => label.id !== labelId),
      });
      invalidateRichness();
    },
  });

  const isMutatingLabel =
    addLabelMutation.isPending ||
    createWorkspaceLabelMutation.isPending ||
    deleteWorkspaceLabelMutation.isPending ||
    quickCreateAndAttachMutation.isPending ||
    removeLabelMutation.isPending ||
    updateWorkspaceLabelMutation.isPending;

  const assignedLabelIds = useMemo(
    () => new Set(labels.map((label) => label.id)),
    [labels],
  );
  const availableLabels = localWorkspaceLabels.filter((label) => !assignedLabelIds.has(label.id));
  const canQuickCreateLabel = canWrite && canManageLabels && availableLabels.length < 1;

  useEffect(() => {
    if (selectedLabelId.length > 0 && availableLabels.some((label) => label.id === selectedLabelId)) {
      return;
    }
    setSelectedLabelId(availableLabels[0]?.id ?? "");
  }, [availableLabels, selectedLabelId]);

  useEffect(() => {
    setLocalWorkspaceLabels(workspaceLabels);
  }, [workspaceLabels]);

  return (
    <section className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/35 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Labels</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.length > 0 ? labels.map((label) => <LabelBadge key={label.id} label={label} />) : (
          <p className="text-xs text-slate-400">No labels on this card.</p>
        )}
      </div>

      {canWrite ? (
        availableLabels.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-[11px] text-slate-300" htmlFor={`assign-label-${cardId}`}>
              Add existing label
            </Label>
            <select
              className="h-9 w-full rounded-md border border-slate-600 bg-[#0f1318] px-2 text-xs text-slate-100"
              disabled={isMutatingLabel}
              id={`assign-label-${cardId}`}
              onChange={(event) => {
                setSelectedLabelId(event.target.value);
              }}
              required
              value={selectedLabelId}
            >
              {availableLabels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
            <button
              className="min-h-8 w-full rounded-md bg-[#0c66e4] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0055cc] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={selectedLabelId.length < 1 || isMutatingLabel}
              onClick={() => {
                if (!canWrite || selectedLabelId.length < 1) {
                  return;
                }
                addLabelMutation.mutate(selectedLabelId);
              }}
              type="button"
            >
              {addLabelMutation.isPending ? "Adding label..." : "Add label to card"}
            </button>
          </div>
        ) : canQuickCreateLabel ? (
          <div className="space-y-2 rounded-md border border-slate-700 bg-[#0f1318] p-2">
            <p className="text-[11px] text-slate-400">No available label. Create one and add it to this card.</p>
            <Input
              className="min-h-9 border-slate-600 bg-[#161b22] text-xs text-slate-100 placeholder:text-slate-400"
              maxLength={50}
              minLength={1}
              onChange={(event) => {
                setQuickCreateName(event.target.value);
              }}
              placeholder="New label name"
              value={quickCreateName}
            />
            <Input
              className="min-h-9 border-slate-600 bg-[#161b22]"
              onChange={(event) => {
                setQuickCreateColor(event.target.value);
              }}
              type="color"
              value={quickCreateColor}
            />
            <button
              className="min-h-8 w-full rounded-md bg-[#0c66e4] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0055cc] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={quickCreateName.trim().length < 1 || isMutatingLabel}
              onClick={() => {
                if (!canWrite || !canManageLabels || quickCreateName.trim().length < 1) {
                  return;
                }
                quickCreateAndAttachMutation.mutate({
                  color: quickCreateColor,
                  name: quickCreateName.trim(),
                });
              }}
              type="button"
            >
              {quickCreateAndAttachMutation.isPending ? "Creating label..." : "Create and add label"}
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">No available label.</p>
        )
      ) : (
        <p className="text-[11px] text-slate-400">Read-only mode: label changes are disabled.</p>
      )}

      {canWrite && labels.length > 0 ? (
        <div className="space-y-1 border-t border-slate-700 pt-2">
          {labels.map((label) => (
            <div className="flex items-center gap-2" key={label.id}>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{label.name}</span>
              <button
                className="min-h-8 rounded-md border border-rose-700 bg-rose-900/30 px-2 text-xs text-rose-100 hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isMutatingLabel}
                onClick={() => {
                  if (!canWrite) {
                    return;
                  }
                  removeLabelMutation.mutate(label.id);
                }}
                type="button"
              >
                {removeLabelMutation.isPending && removeLabelMutation.variables === label.id ? "..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {canManageLabels ? (
        <details className="rounded-md border border-slate-700 bg-[#0f1318] p-2">
          <summary className="cursor-pointer text-[11px] font-medium text-slate-300">
            Manage workspace labels
          </summary>
          <div className="mt-2 space-y-2">
            <Input
              className="min-h-9 border-slate-600 bg-[#161b22] text-xs text-slate-100 placeholder:text-slate-400"
              maxLength={50}
              minLength={1}
              onChange={(event) => {
                setManagerCreateName(event.target.value);
              }}
              placeholder="Label name"
              value={managerCreateName}
            />
            <Input
              className="min-h-9 border-slate-600 bg-[#161b22]"
              onChange={(event) => {
                setManagerCreateColor(event.target.value);
              }}
              type="color"
              value={managerCreateColor}
            />
            <button
              className="min-h-8 w-full rounded-md bg-[#0c66e4] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0055cc] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={managerCreateName.trim().length < 1 || isMutatingLabel}
              onClick={() => {
                if (!canManageLabels || managerCreateName.trim().length < 1) {
                  return;
                }
                createWorkspaceLabelMutation.mutate({
                  color: managerCreateColor,
                  name: managerCreateName.trim(),
                });
              }}
              type="button"
            >
              {createWorkspaceLabelMutation.isPending ? "Creating label..." : "Create label"}
            </button>
          </div>

          <div className="mt-2 space-y-2 border-t border-slate-700 pt-2">
            {localWorkspaceLabels.map((workspaceLabel) => (
              <WorkspaceLabelManagerRow
                canManageLabels={canManageLabels}
                isMutating={isMutatingLabel}
                key={`${workspaceLabel.id}:${workspaceLabel.name}:${workspaceLabel.color}`}
                label={workspaceLabel}
                onDelete={() => {
                  deleteWorkspaceLabelMutation.mutate(workspaceLabel.id);
                }}
                onSave={(nextLabel) => {
                  updateWorkspaceLabelMutation.mutate({
                    color: nextLabel.color,
                    labelId: workspaceLabel.id,
                    name: nextLabel.name,
                  });
                }}
              />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function WorkspaceLabelManagerRow({
  canManageLabels,
  isMutating,
  label,
  onDelete,
  onSave,
}: {
  canManageLabels: boolean;
  isMutating: boolean;
  label: LabelRecord;
  onDelete: () => void;
  onSave: (payload: { color: string; name: string }) => void;
}) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);

  return (
    <div className="rounded-md border border-slate-700 bg-[#161b22] p-2">
      <div className="space-y-2">
        <Input
          className="min-h-8 border-slate-600 bg-[#0f1318] text-xs text-slate-100"
          onChange={(event) => {
            setName(event.target.value);
          }}
          value={name}
        />
        <Input
          className="min-h-8 border-slate-600 bg-[#0f1318]"
          onChange={(event) => {
            setColor(event.target.value);
          }}
          type="color"
          value={color}
        />
        <button
          className="min-h-8 w-full rounded-md bg-[#0c66e4] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0055cc] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canManageLabels || isMutating || name.trim().length < 1}
          onClick={() => {
            if (!canManageLabels || name.trim().length < 1) {
              return;
            }
            onSave({ color, name: name.trim() });
          }}
          type="button"
        >
          Save label
        </button>
      </div>
      <div className="mt-2 border-t border-slate-700 pt-2">
        <button
          className="min-h-8 w-full rounded-md border border-rose-700 bg-rose-900/30 px-3 py-1.5 text-sm font-semibold text-rose-100 hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canManageLabels || isMutating}
          onClick={onDelete}
          type="button"
        >
          Delete label
        </button>
      </div>
    </div>
  );
}

function MemberSelectionPreview({ member }: { member: WorkspaceMemberRecord | null }) {
  if (!member) {
    return <p className="text-[11px] text-slate-400">No member available.</p>;
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-[#0f1318] p-2">
      <Avatar className="h-8 w-8 border border-slate-700">
        {member.avatarUrl ? <AvatarImage alt={member.displayName} src={member.avatarUrl} /> : null}
        <AvatarFallback className="bg-slate-700 text-[10px] text-slate-100">{getInitials(member.displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-200">{member.displayName}</p>
        <p className="text-[11px] text-slate-400 capitalize">{member.role}</p>
      </div>
    </div>
  );
}

// eslint-disable-next-line max-lines-per-function
export function AssigneesSection({
  boardId,
  assignees,
  canWrite,
  cardId,
  onOptimisticCardPatch,
  richnessQueryKey,
  workspaceMembers,
  workspaceSlug,
}: {
  assignees: WorkspaceMemberRecord[];
  boardId: string;
  canWrite: boolean;
  cardId: string;
  onOptimisticCardPatch?: (patch: { assignees: WorkspaceMemberRecord[] }) => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const invalidateRichness = () => invalidateRichnessQuery({
    boardId,
    cardId,
    queryClient,
    richnessQueryKey,
    workspaceSlug,
  });
  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId,
    workspaceSlug,
  });
  const assignedIds = new Set(assignees.map((assignee) => assignee.id));
  const assignableMembers = workspaceMembers.filter((member) => !assignedIds.has(member.id));
  const [selectedUserId, setSelectedUserId] = useState(assignableMembers[0]?.id ?? "");
  const effectiveSelectedUserId = useMemo(() => {
    if (assignableMembers.some((member) => member.id === selectedUserId)) {
      return selectedUserId;
    }

    return assignableMembers[0]?.id ?? "";
  }, [assignableMembers, selectedUserId]);
  const selectedMember = useMemo(
    () => assignableMembers.find((member) => member.id === effectiveSelectedUserId) ?? null,
    [assignableMembers, effectiveSelectedUserId],
  );
  const assignMutation = useMutation({
    mutationKey: [...modalMutationKey, "assignees-assign"],
    mutationFn: async (userId: string) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", cardId);
      formData.set("userId", userId);
      return assignCardMemberInline(formData);
    },
    onSuccess: (result, userId) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể gán thành viên.");
        return;
      }

      const nextAssignee = workspaceMembers.find((member) => member.id === userId);
      if (nextAssignee && !assignees.some((assignee) => assignee.id === nextAssignee.id)) {
        onOptimisticCardPatch?.({ assignees: [...assignees, nextAssignee] });
      }
      invalidateRichness();
    },
  });
  const unassignMutation = useMutation({
    mutationKey: [...modalMutationKey, "assignees-unassign"],
    mutationFn: async (userId: string) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", cardId);
      formData.set("userId", userId);
      return unassignCardMemberInline(formData);
    },
    onSuccess: (result, userId) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể gỡ thành viên.");
        return;
      }

      onOptimisticCardPatch?.({
        assignees: assignees.filter((assignee) => assignee.id !== userId),
      });
      invalidateRichness();
    },
  });
  const isMutating = assignMutation.isPending || unassignMutation.isPending;

  return (
    <section className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/35 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Members</p>
      <div className="flex flex-wrap gap-1.5">
        {assignees.length > 0 ? (
          assignees.map((assignee) => (
            <span className="rounded-full bg-slate-700/90 px-2 py-0.5 text-[11px] text-slate-100" key={assignee.id}>
              {assignee.displayName}
            </span>
          ))
        ) : (
          <p className="text-xs text-slate-400">No assignee yet.</p>
        )}
      </div>

      {canWrite ? (
        <div className="space-y-2">
          <MemberSelectionPreview member={selectedMember} />
          <select
            className="h-9 w-full rounded-md border border-slate-600 bg-[#0f1318] px-2 text-xs text-slate-100"
            disabled={isMutating}
            onChange={(event) => {
              setSelectedUserId(event.target.value);
            }}
            value={effectiveSelectedUserId}
          >
            {assignableMembers.length > 0 ? (
              assignableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))
            ) : (
              <option value="">No member available</option>
            )}
          </select>
          <button
            className="min-h-8 w-full rounded-md bg-[#0c66e4] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0055cc] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={assignableMembers.length === 0 || effectiveSelectedUserId.length < 1}
            onClick={() => {
              if (!canWrite || effectiveSelectedUserId.length < 1) {
                return;
              }
              assignMutation.mutate(effectiveSelectedUserId);
            }}
            type="button"
          >
            {assignMutation.isPending ? "Assigning..." : "Assign member"}
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">Read-only mode: member updates are disabled.</p>
      )}

      {canWrite && assignees.length > 0 ? (
        <div className="space-y-1 border-t border-slate-700 pt-2">
          {assignees.map((assignee) => (
            <div className="flex items-center gap-2" key={assignee.id}>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{assignee.displayName}</span>
              <button
                className="min-h-8 rounded-md border border-rose-700 bg-rose-900/30 px-2 text-xs text-rose-100 hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isMutating}
                onClick={() => {
                  if (!canWrite) {
                    return;
                  }
                  unassignMutation.mutate(assignee.id);
                }}
                type="button"
              >
                {unassignMutation.isPending && unassignMutation.variables === assignee.id ? "..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
