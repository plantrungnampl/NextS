"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  assignCardMemberInline,
  unassignCardMemberInline,
} from "../actions.card-richness";
import type { WorkspaceMemberRecord } from "../types";

type UseMemberAssignmentsArgs = {
  assignees: WorkspaceMemberRecord[];
  boardId: string;
  canWrite: boolean;
  cardId: string;
  onOptimisticAssigneesChange?: (assignees: WorkspaceMemberRecord[]) => void;
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

export function useMemberAssignments({
  assignees,
  boardId,
  canWrite,
  cardId,
  onOptimisticAssigneesChange,
  workspaceMembers,
  workspaceSlug,
}: UseMemberAssignmentsArgs) {
  const [pendingMemberIds, setPendingMemberIds] = useState<Record<string, boolean>>({});
  const [overriddenAssignment, setOverriddenAssignment] = useState<Record<string, boolean>>({});
  const overriddenAssignmentRef = useRef<Record<string, boolean>>({});
  const pendingMemberIdsRef = useRef<Record<string, boolean>>({});
  const initialAssignedMemberIds = useMemo(
    () => new Set(assignees.map((assignee) => assignee.id)),
    [assignees],
  );

  function getAssignedStateFromOverrides(memberId: string, overrides: Record<string, boolean>): boolean {
    if (memberId in overrides) {
      return overrides[memberId];
    }

    return initialAssignedMemberIds.has(memberId);
  }

  function withMemberOverride(
    memberId: string,
    isAssigned: boolean,
    overrides: Record<string, boolean>,
  ): Record<string, boolean> {
    const nextOverrides = { ...overrides };
    const initialAssignedState = initialAssignedMemberIds.has(memberId);
    if (isAssigned === initialAssignedState) {
      delete nextOverrides[memberId];
      return nextOverrides;
    }

    nextOverrides[memberId] = isAssigned;
    return nextOverrides;
  }

  function buildAssignedMembers(overrides: Record<string, boolean>): WorkspaceMemberRecord[] {
    const assignedIds = new Set(initialAssignedMemberIds);
    for (const [memberId, isAssigned] of Object.entries(overrides)) {
      if (isAssigned) {
        assignedIds.add(memberId);
      } else {
        assignedIds.delete(memberId);
      }
    }

    const membersFromWorkspace = workspaceMembers.filter((member) => assignedIds.has(member.id));
    const workspaceMemberIds = new Set(membersFromWorkspace.map((member) => member.id));
    const fallbackMembers = assignees.filter(
      (member) => assignedIds.has(member.id) && !workspaceMemberIds.has(member.id),
    );
    return [...membersFromWorkspace, ...fallbackMembers];
  }

  function emitOverrides(nextOverrides: Record<string, boolean>) {
    setOverriddenAssignment(nextOverrides);
    overriddenAssignmentRef.current = nextOverrides;
    onOptimisticAssigneesChange?.(buildAssignedMembers(nextOverrides));
  }

  function resetAssignments() {
    setPendingMemberIds({});
    pendingMemberIdsRef.current = {};
    setOverriddenAssignment({});
    overriddenAssignmentRef.current = {};
  }

  function getIsAssigned(memberId: string): boolean {
    return getAssignedStateFromOverrides(memberId, overriddenAssignment);
  }

  function handleToggleMember(memberId: string) {
    if (!canWrite || pendingMemberIdsRef.current[memberId]) {
      return;
    }

    const currentOverrides = overriddenAssignmentRef.current;
    const currentAssigned = getAssignedStateFromOverrides(memberId, currentOverrides);
    const nextOverrides = withMemberOverride(memberId, !currentAssigned, currentOverrides);
    emitOverrides(nextOverrides);

    setPendingMemberIds((previous) => {
      const nextPending = { ...previous, [memberId]: true };
      pendingMemberIdsRef.current = nextPending;
      return nextPending;
    });

    void (async () => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("cardId", cardId);
      formData.set("userId", memberId);
      formData.set("workspaceSlug", workspaceSlug);
      const result = currentAssigned
        ? await unassignCardMemberInline(formData)
        : await assignCardMemberInline(formData);

      if (!result.ok) {
        const rollbackOverrides = withMemberOverride(
          memberId,
          currentAssigned,
          overriddenAssignmentRef.current,
        );
        emitOverrides(rollbackOverrides);
        toast.error(result.error ?? "Không thể cập nhật thành viên.");
      }

      setPendingMemberIds((previous) => {
        const nextPending = { ...previous };
        delete nextPending[memberId];
        pendingMemberIdsRef.current = nextPending;
        return nextPending;
      });
    })();
  }

  return {
    getIsAssigned,
    handleToggleMember,
    pendingMemberIds,
    resetAssignments,
  };
}
