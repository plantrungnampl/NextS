"use client";

import {
  CheckSquare2,
  ChevronDown,
  Eye,
  ImageIcon,
  Plus,
  Tag,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";

import type { CardRecord, LabelRecord, WorkspaceMemberRecord } from "../types";
import { CardDatePopover } from "./card-date-popover";
import type { DatePopoverAnchorRect } from "./card-date-popover-anchor";
import { CardHeaderOptionsMenu } from "./card-header-options-menu";
import type { CardCopySummary } from "./card-copy-options-dialog";
import type { CardCustomFieldsOptimisticPatch } from "./card-richness-custom-fields-section";
import { CardMovePanel } from "./card-move-panel";
import { CardQuickAddMenu } from "./card-quick-add-menu";
import type { QuickPanel } from "./card-quick-panel";
import { useCardWatchOptimisticToggle } from "./card-watch-optimistic";
import type { BoardOptimisticChange } from "./board-dnd-helpers";

export type { CardCustomFieldsOptimisticPatch } from "./card-richness-custom-fields-section";
export { CardCustomFieldsSection } from "./card-richness-custom-fields-section";

type DatePopoverState = {
  anchorRect?: DatePopoverAnchorRect;
  open: boolean;
  origin: "chip" | "quick-add";
};

function TopBarMoveButton({
  boardId,
  boardName,
  canWrite,
  card,
  listOptions,
  onOptimisticBoardChange,
  onOptimisticCardPatch,
  richnessQueryKey,
  workspaceSlug,
}: {
  boardId: string;
  boardName: string;
  canWrite: boolean;
  card: CardRecord;
  listOptions: Array<{ id: string; title: string }>;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onOptimisticCardPatch?: (patch: CardCustomFieldsOptimisticPatch) => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
}) {
  const [isMovePanelOpen, setIsMovePanelOpen] = useState(false);
  const listTitle = listOptions.find((listOption) => listOption.id === card.list_id)?.title ?? "Không có danh sách";

  return (
    <Popover
      onOpenChange={(nextOpen) => {
        if (nextOpen && !canWrite) return;
        setIsMovePanelOpen(nextOpen);
      }}
      open={isMovePanelOpen}
    >
      <PopoverTrigger asChild>
        <button
          aria-expanded={isMovePanelOpen}
          aria-haspopup="dialog"
          className={`inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-sm font-medium transition ${isMovePanelOpen ? "bg-[#50555f] text-slate-100" : "bg-white/10 text-slate-100 hover:bg-white/15"} disabled:cursor-not-allowed disabled:opacity-60`}
          disabled={!canWrite}
          type="button"
        >
          {listTitle}
          <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(92vw,320px)] max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-xl border border-[#4a5160] bg-[#2f343d] p-0 text-slate-100 shadow-2xl"
        sideOffset={8}
      >
        <CardMovePanel
          boardId={boardId}
          boardName={boardName}
          canWrite={canWrite}
          cardId={card.id}
          defaultListId={card.list_id}
          listOptions={listOptions}
          onOpenChange={(open) => {
            setIsMovePanelOpen(open);
          }}
          onOptimisticBoardChange={onOptimisticBoardChange}
          onOptimisticCardPatch={onOptimisticCardPatch}
          richnessQueryKey={richnessQueryKey}
          workspaceSlug={workspaceSlug}
        />
      </PopoverContent>
    </Popover>
  );
}

export function TopBar({
  boardId,
  boardName,
  canWrite,
  card,
  copySummary,
  listOptions,
  onClose,
  onOptimisticBoardChange,
  onOptimisticCardPatch,
  richnessQueryKey,
  workspaceSlug,
}: {
  boardId: string;
  boardName: string;
  canWrite: boolean;
  card: CardRecord;
  copySummary: CardCopySummary;
  listOptions: Array<{ id: string; title: string }>;
  onClose: () => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onOptimisticCardPatch?: (patch: CardCustomFieldsOptimisticPatch) => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
}) {
  const { toggleWatch } = useCardWatchOptimisticToggle({
    boardId,
    canWrite,
    card,
    mutationKeySuffix: "header-menu-watch",
    onOptimisticCardPatch,
    richnessQueryKey,
    workspaceSlug,
  });

  return (
    <div className="flex items-center justify-between gap-3">
      <TopBarMoveButton
        boardId={boardId}
        boardName={boardName}
        canWrite={canWrite}
        card={card}
        listOptions={listOptions}
        onOptimisticBoardChange={onOptimisticBoardChange}
        onOptimisticCardPatch={onOptimisticCardPatch}
        richnessQueryKey={richnessQueryKey}
        workspaceSlug={workspaceSlug}
      />

      <div className="flex items-center gap-1">
        <button
          aria-label="Card cover"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-slate-100"
          type="button"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        {card.watchedByViewer ? (
          <button
            aria-label="Tắt theo dõi thẻ"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-slate-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canWrite}
            onClick={toggleWatch}
            title="Bạn đang theo dõi thẻ này. Nhấn để tắt theo dõi."
            type="button"
          >
            <Eye className="h-4 w-4" />
          </button>
        ) : null}
        <CardHeaderOptionsMenu
          boardId={boardId}
          boardName={boardName}
          canWrite={canWrite}
          card={card}
          copySummary={copySummary}
          listOptions={listOptions}
          onCloseAfterDestructive={onClose}
          onOptimisticBoardChange={onOptimisticBoardChange}
          onOptimisticCardPatch={onOptimisticCardPatch}
          onToggleWatch={toggleWatch}
          richnessQueryKey={richnessQueryKey}
          watchedByViewer={card.watchedByViewer === true}
          workspaceSlug={workspaceSlug}
        />
        <button
          aria-label="Close card modal"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-slate-100"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function QuickActionChips({
  activePanel,
  boardId,
  card,
  canManageLabels,
  canWrite,
  labels,
  onOptimisticCardPatch,
  onChecklistCreated,
  onOptimisticLabelsChange,
  onSelectPanel,
  richnessQueryKey,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: {
  activePanel: QuickPanel;
  boardId: string;
  card: CardRecord;
  canManageLabels: boolean;
  canWrite: boolean;
  labels: LabelRecord[];
  onOptimisticCardPatch?: (patch: CardCustomFieldsOptimisticPatch) => void;
  onChecklistCreated?: () => void | Promise<void>;
  onOptimisticLabelsChange?: (labels: LabelRecord[]) => void;
  onSelectPanel: (panel: QuickPanel) => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
}) {
  const [datePopoverState, setDatePopoverState] = useState<DatePopoverState>({
    open: false,
    origin: "chip",
  });
  const handleDatePopoverOpenChange = (nextOpen: boolean) => {
    setDatePopoverState((previous) => {
      if (nextOpen) {
        if (previous.open) {
          return previous;
        }
        return {
          anchorRect: undefined,
          open: true,
          origin: "chip",
        };
      }
      return {
        anchorRect: undefined,
        open: false,
        origin: "chip",
      };
    });
  };
  const handleOpenDatePopoverFromQuickAdd = ({
    anchorRect,
  }: {
    anchorRect?: DatePopoverAnchorRect;
  }) => {
    setDatePopoverState({
      anchorRect,
      open: true,
      origin: "quick-add",
    });
  };
  const chipClass =
    "inline-flex h-10 items-center gap-1.5 rounded-md border border-slate-600 px-3 text-sm font-medium text-slate-200 transition hover:bg-white/5";
  const quickAddMenuCommonProps = {
    assignees: card.assignees,
    boardId,
    buttonClassName: chipClass,
    canManageLabels,
    canWrite,
    cardId: card.id,
    labels,
    onChecklistCreated,
    onOpenDatePopover: handleOpenDatePopoverFromQuickAdd,
    onOptimisticAssigneesChange: (nextAssignees: WorkspaceMemberRecord[]) => {
      onOptimisticCardPatch?.({ assignees: nextAssignees });
    },
    onOptimisticLabelsChange,
    richnessQueryKey,
    onSelectPanel,
    workspaceLabels,
    workspaceMembers,
    workspaceSlug,
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CardQuickAddMenu {...quickAddMenuCommonProps} triggerLabel="Thêm" />
      <CardQuickAddMenu
        {...quickAddMenuCommonProps}
        defaultOpenView="labels"
        triggerIcon={<Tag className="h-4 w-4" />}
        triggerLabel="Nhãn"
      />
      <CardDatePopover
        boardId={boardId}
        buttonClassName={chipClass}
        canWrite={canWrite}
        anchorRect={datePopoverState.anchorRect}
        card={card}
        onOpenChange={handleDatePopoverOpenChange}
        onOptimisticCardPatch={onOptimisticCardPatch}
        open={datePopoverState.open}
        openOrigin={datePopoverState.origin}
        richnessQueryKey={richnessQueryKey}
        workspaceSlug={workspaceSlug}
      />
      <CardQuickAddMenu
        {...quickAddMenuCommonProps}
        defaultOpenView="create-checklist"
        triggerIcon={<CheckSquare2 className="h-4 w-4" />}
        triggerLabel="Việc cần làm"
      />
    </div>
  );
}

export function ModalLabelStrip({
  canWrite,
  labels,
  onOpenLabelsPanel,
}: {
  canWrite: boolean;
  labels: LabelRecord[];
  onOpenLabelsPanel: () => void;
}) {
  if (labels.length < 1) {
    return null;
  }

  return (
    <section className="space-y-1.5">
      <p className="text-sm font-semibold text-slate-300">Nhãn</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.map((label) => (
          <span
            className="h-8 w-14 rounded-md border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
            key={label.id}
            style={{ backgroundColor: label.color }}
            title={label.name}
          />
        ))}
        <button
          aria-label="Mở bảng nhãn"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/10 text-slate-200 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canWrite}
          onClick={onOpenLabelsPanel}
          type="button"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

export function UtilityBar() {
  return (
    <div className="sticky bottom-2 z-10 mt-6 flex justify-center">
      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-[#2c2d33]/95 p-2 shadow-xl backdrop-blur">
        <button className="h-9 rounded-md px-3 text-sm font-medium text-slate-100 hover:bg-white/10" type="button">
          Power-up
        </button>
        <button className="h-9 rounded-md px-3 text-sm font-medium text-slate-100 hover:bg-white/10" type="button">
          Tự động hóa
        </button>
        <button className="h-9 rounded-md px-3 text-sm font-medium text-slate-100 hover:bg-white/10" type="button">
          Nhận xét
        </button>
      </div>
    </div>
  );
}
