"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { addCardLabelInline, removeCardLabelInline } from "../actions.card-richness";
import type { LabelRecord } from "../types";

type UseLabelAssignmentsArgs = {
  boardId: string;
  canWrite: boolean;
  cardId: string;
  labelCatalog: LabelRecord[];
  labels: LabelRecord[];
  onOptimisticLabelsChange?: (labels: LabelRecord[]) => void;
  workspaceSlug: string;
};

export function useLabelAssignments({
  boardId,
  canWrite,
  cardId,
  labelCatalog,
  labels,
  onOptimisticLabelsChange,
  workspaceSlug,
}: UseLabelAssignmentsArgs) {
  const [pendingLabelIds, setPendingLabelIds] = useState<Record<string, boolean>>({});
  const [overriddenAssignment, setOverriddenAssignment] = useState<Record<string, boolean>>({});
  const overriddenAssignmentRef = useRef<Record<string, boolean>>({});
  const pendingLabelIdsRef = useRef<Record<string, boolean>>({});
  const initialAssignedLabelIds = useMemo(() => new Set(labels.map((label) => label.id)), [labels]);

  function getAssignedStateFromOverrides(labelId: string, overrides: Record<string, boolean>): boolean {
    if (labelId in overrides) {
      return overrides[labelId];
    }
    return initialAssignedLabelIds.has(labelId);
  }

  function withLabelOverride(
    labelId: string,
    isAssigned: boolean,
    overrides: Record<string, boolean>,
  ): Record<string, boolean> {
    const nextOverrides = { ...overrides };
    const initialAssignedState = initialAssignedLabelIds.has(labelId);
    if (isAssigned === initialAssignedState) {
      delete nextOverrides[labelId];
      return nextOverrides;
    }

    nextOverrides[labelId] = isAssigned;
    return nextOverrides;
  }

  function buildAssignedLabels(overrides: Record<string, boolean>): LabelRecord[] {
    const assignedIds = new Set(initialAssignedLabelIds);
    for (const [labelId, isAssigned] of Object.entries(overrides)) {
      if (isAssigned) {
        assignedIds.add(labelId);
      } else {
        assignedIds.delete(labelId);
      }
    }

    const labelsFromCatalog = labelCatalog.filter((label) => assignedIds.has(label.id));
    const catalogIds = new Set(labelsFromCatalog.map((label) => label.id));
    const fallbackLabels = labels.filter((label) => assignedIds.has(label.id) && !catalogIds.has(label.id));
    return [...labelsFromCatalog, ...fallbackLabels];
  }

  function emitOverrides(nextOverrides: Record<string, boolean>) {
    setOverriddenAssignment(nextOverrides);
    overriddenAssignmentRef.current = nextOverrides;
    onOptimisticLabelsChange?.(buildAssignedLabels(nextOverrides));
  }

  function resetAssignments() {
    setPendingLabelIds({});
    pendingLabelIdsRef.current = {};
    setOverriddenAssignment({});
    overriddenAssignmentRef.current = {};
  }

  function forceAssignment(labelId: string, isAssigned: boolean) {
    const nextOverrides = withLabelOverride(labelId, isAssigned, overriddenAssignmentRef.current);
    emitOverrides(nextOverrides);
  }

  function getIsAssigned(labelId: string): boolean {
    return getAssignedStateFromOverrides(labelId, overriddenAssignment);
  }

  function handleToggleLabel(labelId: string) {
    if (!canWrite || pendingLabelIdsRef.current[labelId]) {
      return;
    }

    const currentOverrides = overriddenAssignmentRef.current;
    const currentAssigned = getAssignedStateFromOverrides(labelId, currentOverrides);
    const nextOverrides = withLabelOverride(labelId, !currentAssigned, currentOverrides);

    emitOverrides(nextOverrides);
    setPendingLabelIds((previous) => {
      const nextPending = { ...previous, [labelId]: true };
      pendingLabelIdsRef.current = nextPending;
      return nextPending;
    });

    void (async () => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("cardId", cardId);
      formData.set("labelId", labelId);
      formData.set("workspaceSlug", workspaceSlug);
      const result = currentAssigned
        ? await removeCardLabelInline(formData)
        : await addCardLabelInline(formData);

      if (!result.ok) {
        const rollbackOverrides = withLabelOverride(
          labelId,
          currentAssigned,
          overriddenAssignmentRef.current,
        );
        emitOverrides(rollbackOverrides);
        toast.error(result.error ?? "Không thể cập nhật nhãn.");
      }

      setPendingLabelIds((previous) => {
        const nextPending = { ...previous };
        delete nextPending[labelId];
        pendingLabelIdsRef.current = nextPending;
        return nextPending;
      });
    })();
  }

  return { forceAssignment, getIsAssigned, handleToggleLabel, pendingLabelIds, resetAssignments };
}
