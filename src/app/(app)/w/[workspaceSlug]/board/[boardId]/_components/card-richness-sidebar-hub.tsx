"use client";

import {
  Archive,
  CalendarClock,
  Copy,
  ListChecks,
  MoveRight,
  Paperclip,
  Plus,
  Star,
  Tag,
  Trash2,
  UserPlus,
} from "lucide-react";
import { type ComponentType, type Dispatch, type SetStateAction, useState } from "react";

import { Button } from "@/components/ui";
import { cn } from "@/shared";

import type { CardRecord, LabelRecord, WorkspaceMemberRecord } from "../types";
import { AssigneesSection, LabelsSection } from "./card-richness-sections";
import { SidebarActions } from "./card-richness-sidebar";

type SidebarPanel = "actions" | "labels" | "members" | null;

type CardModalSidebarHubProps = {
  assignees: WorkspaceMemberRecord[];
  boardId: string;
  canManageLabels: boolean;
  canWrite: boolean;
  card: CardRecord;
  hasLoadingError: boolean;
  isInitialLoading: boolean;
  labels: LabelRecord[];
  listOptions: Array<{ id: string; title: string }>;
  onJumpToAttachments: () => void;
  onJumpToChecklist: () => void;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

const sidebarActionItemClass =
  "flex min-h-8 w-full items-center justify-start gap-2 rounded-md px-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800/70";

function SidebarActionItem({
  icon: Icon,
  isActive,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        sidebarActionItemClass,
        isActive ? "bg-slate-700/80 text-slate-100" : null,
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function AddToCardMenu({
  activePanel,
  onJumpToAttachments,
  onJumpToChecklist,
  setActivePanel,
}: {
  activePanel: SidebarPanel;
  onJumpToAttachments: () => void;
  onJumpToChecklist: () => void;
  setActivePanel: Dispatch<SetStateAction<SidebarPanel>>;
}) {
  return (
    <section className="space-y-1">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Add to card</p>
      <SidebarActionItem
        icon={UserPlus}
        isActive={activePanel === "members"}
        label="Members"
        onClick={() => {
          setActivePanel("members");
        }}
      />
      <SidebarActionItem
        icon={Tag}
        isActive={activePanel === "labels"}
        label="Labels"
        onClick={() => {
          setActivePanel("labels");
        }}
      />
      <SidebarActionItem
        icon={ListChecks}
        isActive={false}
        label="Checklist"
        onClick={onJumpToChecklist}
      />
      <SidebarActionItem
        icon={CalendarClock}
        isActive={activePanel === "actions"}
        label="Due date"
        onClick={() => {
          setActivePanel("actions");
        }}
      />
      <SidebarActionItem
        icon={Paperclip}
        isActive={false}
        label="Attachment"
        onClick={onJumpToAttachments}
      />
    </section>
  );
}

function SidebarMetaSections() {
  return (
    <>
      <section className="space-y-1">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Power-Ups</p>
        <button className={sidebarActionItemClass} type="button">
          <Plus className="h-3.5 w-3.5" />
          Add Power-Ups
        </button>
        <p className="px-1 text-[11px] text-slate-400">Get unlimited Power-Ups, plus much more.</p>
      </section>

      <section className="space-y-1">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Butler</p>
        <button className={sidebarActionItemClass} type="button">
          <Plus className="h-3.5 w-3.5" />
          Add card button
        </button>
      </section>
    </>
  );
}

function ActionsMenu({
  activePanel,
  setActivePanel,
}: {
  activePanel: SidebarPanel;
  setActivePanel: Dispatch<SetStateAction<SidebarPanel>>;
}) {
  return (
    <section className="space-y-1">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Actions</p>
      <SidebarActionItem
        icon={MoveRight}
        isActive={activePanel === "actions"}
        label="Move"
        onClick={() => {
          setActivePanel("actions");
        }}
      />
      <SidebarActionItem
        icon={Copy}
        isActive={activePanel === "actions"}
        label="Copy"
        onClick={() => {
          setActivePanel("actions");
        }}
      />
      <SidebarActionItem
        icon={Star}
        isActive={activePanel === "actions"}
        label="Watch"
        onClick={() => {
          setActivePanel("actions");
        }}
      />
      <SidebarActionItem
        icon={Archive}
        isActive={activePanel === "actions"}
        label="Archive"
        onClick={() => {
          setActivePanel("actions");
        }}
      />
      <SidebarActionItem
        icon={Trash2}
        isActive={activePanel === "actions"}
        label="Delete"
        onClick={() => {
          setActivePanel("actions");
        }}
      />
    </section>
  );
}

function SidebarDetails({
  activePanel,
  assignees,
  boardId,
  canManageLabels,
  canWrite,
  card,
  hasLoadingError,
  isInitialLoading,
  labels,
  listOptions,
  setActivePanel,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: Omit<CardModalSidebarHubProps, "onJumpToAttachments" | "onJumpToChecklist"> & {
  activePanel: SidebarPanel;
  setActivePanel: Dispatch<SetStateAction<SidebarPanel>>;
}) {
  if (isInitialLoading || hasLoadingError || !activePanel) {
    return null;
  }

  return (
    <>
      {activePanel === "labels" ? (
        <LabelsSection
          boardId={boardId}
          canManageLabels={canManageLabels}
          canWrite={canWrite}
          cardId={card.id}
          labels={labels}
          workspaceLabels={workspaceLabels}
          workspaceSlug={workspaceSlug}
        />
      ) : null}

      {activePanel === "members" ? (
        <AssigneesSection
          assignees={assignees}
          boardId={boardId}
          canWrite={canWrite}
          cardId={card.id}
          workspaceMembers={workspaceMembers}
          workspaceSlug={workspaceSlug}
        />
      ) : null}

      {activePanel === "actions" ? (
        <SidebarActions
          boardId={boardId}
          canWrite={canWrite}
          card={card}
          listOptions={listOptions}
          workspaceSlug={workspaceSlug}
        />
      ) : null}

      <Button
        className="w-full !border-slate-600 !bg-slate-900/55 !text-slate-100 hover:!bg-slate-800"
        onClick={() => {
          setActivePanel(null);
        }}
        type="button"
        variant="secondary"
      >
        Hide details
      </Button>
    </>
  );
}

export function CardModalSidebarHub({
  onJumpToAttachments,
  onJumpToChecklist,
  ...props
}: CardModalSidebarHubProps) {
  const [activePanel, setActivePanel] = useState<SidebarPanel>(null);

  return (
    <aside className="space-y-4 lg:border-l lg:border-slate-700/60 lg:pl-4">
      <AddToCardMenu
        activePanel={activePanel}
        onJumpToAttachments={onJumpToAttachments}
        onJumpToChecklist={onJumpToChecklist}
        setActivePanel={setActivePanel}
      />
      <SidebarMetaSections />
      <ActionsMenu activePanel={activePanel} setActivePanel={setActivePanel} />
      <SidebarDetails activePanel={activePanel} setActivePanel={setActivePanel} {...props} />
    </aside>
  );
}
