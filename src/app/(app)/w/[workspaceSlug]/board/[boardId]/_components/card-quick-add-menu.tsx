"use client";

import { Plus } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";

import type { LabelRecord, WorkspaceMemberRecord } from "../types";
import type { DatePopoverAnchorRect } from "./card-date-popover-anchor";
import type { QuickPanel } from "./card-quick-panel";
import { useLabelAssignments } from "./card-quick-add-menu-assignments";
import { useQuickAddAttachmentsMutation } from "./card-quick-add-menu-attachments-mutation";
import { useMemberAssignments } from "./card-quick-add-menu-members";
import { AttachmentsPanel } from "./card-quick-add-menu-attachments-panel";
import { mergeFiles, type MenuView, useQuickAddMenuState } from "./card-quick-add-menu-state";
import {
  AddMenuPanel,
  CreateChecklistPanel,
  CreateLabelPanel,
  LabelsPanel,
  type AddMenuItem,
} from "./card-quick-add-menu-panels";
import { MembersPanel } from "./card-quick-add-menu-members-panel";

type CardQuickAddMenuProps = {
  boardId: string;
  buttonClassName: string;
  canManageLabels: boolean;
  canWrite: boolean;
  cardId: string;
  defaultOpenView?: MenuView;
  labels: LabelRecord[];
  onChecklistCreated?: () => void | Promise<void>;
  onOpenDatePopover?: (payload: {
    anchorRect?: DatePopoverAnchorRect;
    origin: "quick-add";
  }) => void;
  onOptimisticAssigneesChange?: (assignees: WorkspaceMemberRecord[]) => void;
  onOptimisticLabelsChange?: (labels: LabelRecord[]) => void;
  richnessQueryKey?: readonly [string, string, string, string];
  onSelectPanel: (panel: QuickPanel) => void;
  triggerIcon?: ReactNode;
  triggerLabel: string;
  assignees: WorkspaceMemberRecord[];
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

// eslint-disable-next-line max-lines-per-function
export function CardQuickAddMenu({
  assignees,
  boardId,
  buttonClassName,
  canManageLabels,
  canWrite,
  cardId,
  defaultOpenView = "menu",
  labels,
  onChecklistCreated,
  onOpenDatePopover,
  onOptimisticAssigneesChange,
  onOptimisticLabelsChange,
  richnessQueryKey,
  onSelectPanel,
  triggerIcon,
  triggerLabel,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: CardQuickAddMenuProps) {
  const [open, setOpen] = useState(false);
  const pendingDateOpenRafRef = useRef<number | null>(null);
  const pendingDateOpenTimerRef = useRef<number | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const {
    activeView,
    attachmentDisplayText,
    attachmentUrl,
    createColor,
    createChecklistTitle,
    createName,
    hydrateDefaultLabelsIfNeeded,
    isCreatingChecklist,
    isCreatingLabel,
    isHydratingDefaults,
    isLoadingRecentAttachmentLinks,
    localWorkspaceLabels,
    loadRecentAttachmentLinks,
    memberQuery,
    openCreateLabelView,
    query,
    recentAttachmentLinks,
    resetMenuState,
    runCreateChecklist,
    runCreateLabel,
    selectedAttachmentFiles,
    setActiveView,
    setAttachmentDisplayText,
    setAttachmentUrl,
    setCreateColor,
    setCreateChecklistTitle,
    setCreateName,
    setMemberQuery,
    setSelectedAttachmentFiles,
    setQuery,
  } = useQuickAddMenuState({ boardId, canManageLabels, canWrite, cardId, workspaceLabels, workspaceSlug });
  const {
    forceAssignment,
    getIsAssigned,
    handleToggleLabel,
    pendingLabelIds,
    resetAssignments: resetLabelAssignments,
  } = useLabelAssignments({
    boardId,
    canWrite,
    cardId,
    labelCatalog: localWorkspaceLabels,
    labels,
    onOptimisticLabelsChange,
    workspaceSlug,
  });
  const {
    getIsAssigned: getIsMemberAssigned,
    handleToggleMember,
    pendingMemberIds,
    resetAssignments: resetMemberAssignments,
  } = useMemberAssignments({
    assignees,
    boardId,
    canWrite,
    cardId,
    onOptimisticAssigneesChange,
    workspaceMembers,
    workspaceSlug,
  });
  const clearPendingDateOpen = () => {
    if (pendingDateOpenRafRef.current !== null) {
      window.cancelAnimationFrame(pendingDateOpenRafRef.current);
      pendingDateOpenRafRef.current = null;
    }
    if (pendingDateOpenTimerRef.current !== null) {
      window.clearTimeout(pendingDateOpenTimerRef.current);
      pendingDateOpenTimerRef.current = null;
    }
  };
  const buildNormalizedAnchorRect = (): DatePopoverAnchorRect | undefined => {
    const triggerRect = triggerButtonRef.current?.getBoundingClientRect();
    if (!triggerRect) {
      return undefined;
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    return {
      height: Math.max(1, Math.round(triggerRect.height)),
      left: Math.max(0, Math.min(Math.round(triggerRect.left), Math.max(0, viewportWidth - 1))),
      top: Math.max(0, Math.min(Math.round(triggerRect.top), Math.max(0, viewportHeight - 1))),
      width: Math.max(1, Math.round(triggerRect.width)),
    };
  };
  const scheduleOpenDatePopover = () => {
    if (!onOpenDatePopover) {
      return;
    }

    clearPendingDateOpen();
    pendingDateOpenRafRef.current = window.requestAnimationFrame(() => {
      pendingDateOpenRafRef.current = null;
      pendingDateOpenTimerRef.current = window.setTimeout(() => {
        pendingDateOpenTimerRef.current = null;
        onOpenDatePopover({
          anchorRect: buildNormalizedAnchorRect(),
          origin: "quick-add",
        });
      }, 0);
    });
  };
  const closePopover = () => handleOpenChange(false);
  const { isSubmitting, submitAttachments } = useQuickAddAttachmentsMutation({
    attachmentDisplayText,
    attachmentUrl,
    boardId,
    canWrite,
    cardId,
    closePopover,
    loadRecentAttachmentLinks,
    richnessQueryKey,
    selectedAttachmentFiles,
    setAttachmentDisplayText,
    setAttachmentUrl,
    setSelectedAttachmentFiles,
    workspaceMembers,
    workspaceSlug,
  });

  const handleSubmitAttachments = () => {
    const submitError = submitAttachments();
    if (submitError) {
      toast.error(submitError);
    }
  };

  useEffect(() => {
    return () => {
      clearPendingDateOpen();
    };
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetMenuState();
      resetLabelAssignments();
      resetMemberAssignments();
      return;
    }
    setActiveView(defaultOpenView);
    if (defaultOpenView === "labels") {
      hydrateDefaultLabelsIfNeeded();
      return;
    }
    if (defaultOpenView === "attachments") {
      void loadRecentAttachmentLinks();
    }
  }

  function handleMenuItemClick(item: AddMenuItem, _event: MouseEvent<HTMLButtonElement>) {
    if (item.action === "open-date-popover") {
      closePopover();
      // Defer opening Date popover to avoid Radix outside-click race in the same tick.
      scheduleOpenDatePopover();
      return;
    }

    if (item.action === "open-members-panel") {
      setActiveView("members");
      return;
    }

    if (item.action === "open-attachments-panel") {
      setActiveView("attachments");
      void loadRecentAttachmentLinks();
      return;
    }

    if (item.panel === "labels") {
      setActiveView("labels");
      hydrateDefaultLabelsIfNeeded();
      return;
    }

    if (item.panel === "checklist") {
      setCreateChecklistTitle("Việc cần làm");
      setActiveView("create-checklist");
      return;
    }

    onSelectPanel(item.panel);
    if (item.toastMessage) {
      toast.info(item.toastMessage);
    }
    closePopover();
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <button className={buttonClassName} ref={triggerButtonRef} type="button">
          {triggerIcon ?? <Plus className="h-4 w-4" />}
          {triggerLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[304px] border-slate-600 bg-[#33363d] p-0 text-slate-100" data-lane-pan-stop>
        {activeView === "menu" ? <AddMenuPanel onClose={closePopover} onItemClick={handleMenuItemClick} /> : null}
        {activeView === "labels" ? (
          <LabelsPanel
            canManageLabels={canManageLabels}
            canWrite={canWrite}
            getIsAssigned={getIsAssigned}
            isHydratingDefaults={isHydratingDefaults}
            labels={localWorkspaceLabels}
            onBack={() => setActiveView("menu")}
            onClose={closePopover}
            onCreateLabel={openCreateLabelView}
            onQueryChange={setQuery}
            onToggleLabel={handleToggleLabel}
            pendingLabelIds={pendingLabelIds}
            query={query}
          />
        ) : null}
        {activeView === "create-label" ? (
          <CreateLabelPanel
            canManageLabels={canManageLabels}
            color={createColor}
            isCreating={isCreatingLabel}
            name={createName}
            onBack={() => setActiveView("labels")}
            onClose={closePopover}
            onColorChange={setCreateColor}
            onNameChange={setCreateName}
            onRemoveColor={() => setCreateColor(null)}
            onSubmit={() => {
              runCreateLabel((label) => {
                if (label) {
                  forceAssignment(label.id, true);
                }
              });
            }}
          />
        ) : null}
        {activeView === "create-checklist" ? (
          <CreateChecklistPanel
            isSubmitting={isCreatingChecklist}
            onBack={() => setActiveView("menu")}
            onClose={closePopover}
            onSubmit={() => {
              runCreateChecklist((created) => {
                if (!created) {
                  return;
                }

                void onChecklistCreated?.();
                onSelectPanel("checklist");
                closePopover();
              });
            }}
            onTitleChange={setCreateChecklistTitle}
            title={createChecklistTitle}
          />
        ) : null}
        {activeView === "attachments" ? (
          <AttachmentsPanel
            canWrite={canWrite}
            displayText={attachmentDisplayText}
            isLoadingRecentLinks={isLoadingRecentAttachmentLinks}
            isSubmitting={isSubmitting}
            onBack={() => setActiveView("menu")}
            onClose={closePopover}
            onDisplayTextChange={setAttachmentDisplayText}
            onPickRecentLink={(link) => {
              setAttachmentUrl(link.url);
              if (attachmentDisplayText.trim().length < 1) {
                setAttachmentDisplayText(link.title);
              }
            }}
            onRemoveSelectedFile={(index) => {
              setSelectedAttachmentFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
            }}
            onSelectFiles={(files) => {
              setSelectedAttachmentFiles((previous) => mergeFiles(previous, files));
            }}
            onSubmit={handleSubmitAttachments}
            onUrlChange={setAttachmentUrl}
            recentLinks={recentAttachmentLinks}
            selectedFiles={selectedAttachmentFiles}
            urlValue={attachmentUrl}
          />
        ) : null}
        {activeView === "members" ? (
          <MembersPanel
            canWrite={canWrite}
            getIsAssigned={getIsMemberAssigned}
            members={workspaceMembers}
            onBack={() => setActiveView("menu")}
            onClose={closePopover}
            onQueryChange={setMemberQuery}
            onToggleMember={handleToggleMember}
            pendingMemberIds={pendingMemberIds}
            query={memberQuery}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
