"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  Copy,
  Eye,
  LayoutTemplate,
  MoreHorizontal,
  MoveRight,
  Share2,
  SplitSquareHorizontal,
  UserPlus,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui";

import { archiveCardInline } from "../actions.forms";
import type { CardRecord } from "../types";
import { invalidateCardRichnessQuery } from "./board-mutations/invalidation";
import { CardCopyOptionsDialog, type CardCopySummary } from "./card-copy-options-dialog";
import { CardMovePanel } from "./card-move-panel";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";
import { CardSharePanel } from "./card-share-panel";
import type { BoardOptimisticChange } from "./board-dnd-helpers";

type HeaderMenuOptimisticPatch = Partial<Pick<CardRecord, "list_id" | "watchCount" | "watchedByViewer">>;
type HeaderPanel = "copy" | "move" | "share" | null;

type CardHeaderOptionsMenuProps = {
  boardId: string;
  boardName: string;
  canWrite: boolean;
  card: CardRecord;
  copySummary: CardCopySummary;
  listOptions: Array<{ id: string; title: string }>;
  onCloseAfterDestructive?: () => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onOptimisticCardPatch?: (patch: HeaderMenuOptimisticPatch) => void;
  onToggleWatch?: () => void;
  richnessQueryKey?: readonly [string, string, string, string];
  watchedByViewer?: boolean;
  workspaceSlug: string;
};

function buildFormData(entries: Array<[string, string]>): FormData {
  const formData = new FormData();
  for (const [key, value] of entries) {
    formData.set(key, value);
  }

  return formData;
}

function DisabledMenuItem({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <DropdownMenuItem className="h-9 cursor-not-allowed rounded-md px-2.5 text-slate-300/65 focus:bg-transparent focus:text-slate-300/65" disabled>
      <span className="inline-flex items-center gap-2.5">
        {icon}
        {label}
      </span>
    </DropdownMenuItem>
  );
}

// eslint-disable-next-line max-lines-per-function
export function CardHeaderOptionsMenu({
  boardId,
  boardName,
  canWrite,
  card,
  copySummary,
  listOptions,
  onCloseAfterDestructive,
  onOptimisticBoardChange,
  onOptimisticCardPatch,
  onToggleWatch,
  richnessQueryKey,
  watchedByViewer = card.watchedByViewer === true,
  workspaceSlug,
}: CardHeaderOptionsMenuProps) {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<HeaderPanel>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const pendingPanelOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingPanelFromMenuRef = useRef(false);
  const suppressPopoverCloseUntilRef = useRef(0);

  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId: card.id,
    workspaceSlug,
  });
  const archiveMutation = useMutation({
    mutationKey: [...modalMutationKey, "header-menu-archive"],
    mutationFn: async () => {
      return archiveCardInline(
        buildFormData([
          ["boardId", boardId],
          ["cardId", card.id],
          ["workspaceSlug", workspaceSlug],
        ]),
      );
    },
    onMutate: () =>
      onOptimisticBoardChange({
        cardId: card.id,
        type: "remove-card",
      }),
    onError: (_error, _variables, rollback) => {
      rollback?.();
    },
    onSuccess: (result, _variables, rollback) => {
      if (!result.ok) {
        rollback?.();
        toast.error(result.error ?? "Không thể lưu trữ thẻ.");
        return;
      }

      toast.success("Đã lưu trữ thẻ.");
      invalidateCardRichnessQuery({
        boardId,
        cardId: card.id,
        queryClient,
        richnessQueryKey,
        workspaceSlug,
      });
      onCloseAfterDestructive?.();
      setArchiveDialogOpen(false);
      setMenuOpen(false);
    },
  });

  const isMutating = archiveMutation.isPending;
  const isPopoverPanelOpen = activePanel !== null;
  const popoverWidthClassName =
    activePanel === "copy"
      ? "w-[min(92vw,380px)]"
      : activePanel === "move"
        ? "w-[min(92vw,320px)]"
        : "w-[min(92vw,360px)]";
  const itemClassName = "h-9 rounded-md px-2.5 text-slate-200 focus:bg-white/10 focus:text-slate-100";
  const openPanel = (panel: Exclude<HeaderPanel, null>) => {
    openingPanelFromMenuRef.current = true;
    setMenuOpen(false);
    if (pendingPanelOpenTimerRef.current) {
      clearTimeout(pendingPanelOpenTimerRef.current);
      pendingPanelOpenTimerRef.current = null;
    }
    pendingPanelOpenTimerRef.current = setTimeout(() => {
      suppressPopoverCloseUntilRef.current = Date.now() + 180;
      setActivePanel(panel);
      openingPanelFromMenuRef.current = false;
      pendingPanelOpenTimerRef.current = null;
    }, 30);
  };

  useEffect(() => {
    return () => {
      if (pendingPanelOpenTimerRef.current) {
        clearTimeout(pendingPanelOpenTimerRef.current);
      }
      openingPanelFromMenuRef.current = false;
    };
  }, []);

  return (
    <>
      <Popover
        onOpenChange={(nextOpen) => {
          if (!nextOpen && Date.now() < suppressPopoverCloseUntilRef.current) {
            return;
          }
          if (!nextOpen) {
            setActivePanel(null);
          }
        }}
        open={isPopoverPanelOpen}
      >
        <PopoverAnchor asChild>
          <div className="inline-flex">
            <DropdownMenu
              onOpenChange={(nextOpen) => {
                setMenuOpen(nextOpen);
                if (nextOpen) {
                  if (pendingPanelOpenTimerRef.current) {
                    clearTimeout(pendingPanelOpenTimerRef.current);
                    pendingPanelOpenTimerRef.current = null;
                  }
                  openingPanelFromMenuRef.current = false;
                  setActivePanel(null);
                }
              }}
              open={menuOpen}
            >
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Card options"
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-slate-100 ${menuOpen || isPopoverPanelOpen ? "bg-[#50555f] text-slate-100" : ""}`}
                  type="button"
                >
                  <span className="sr-only">Mở menu tùy chọn thẻ</span>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl border border-[#4a5160] bg-[#2f343d] p-1.5 text-slate-100 shadow-2xl"
                onCloseAutoFocus={(event) => {
                  if (openingPanelFromMenuRef.current) {
                    event.preventDefault();
                  }
                }}
                sideOffset={6}
              >
                <DisabledMenuItem
                  icon={<UserPlus className="h-4 w-4" />}
                  label="Tham gia"
                />
                <DropdownMenuItem
                  className={itemClassName}
                  disabled={!canWrite || isMutating}
                  onSelect={(event) => {
                    event.preventDefault();
                    openPanel("move");
                  }}
                >
                  <MoveRight className="mr-2 h-4 w-4" />
                  Di chuyển
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={itemClassName}
                  disabled={!canWrite || isMutating}
                  onSelect={(event) => {
                    event.preventDefault();
                    openPanel("copy");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Sao chép
                </DropdownMenuItem>
                <DisabledMenuItem
                  icon={<SplitSquareHorizontal className="h-4 w-4" />}
                  label="Đối xứng"
                />
                <DisabledMenuItem
                  icon={<LayoutTemplate className="h-4 w-4" />}
                  label="Tạo mẫu"
                />
                <DropdownMenuItem
                  className={`${itemClassName} ${watchedByViewer ? "bg-white/10 text-slate-100" : ""}`}
                  disabled={!canWrite}
                  onSelect={(event) => {
                    event.preventDefault();
                    if (!onToggleWatch) {
                      return;
                    }
                    onToggleWatch();
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Theo dõi
                  {watchedByViewer ? (
                    <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-sm bg-lime-400 text-slate-900">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-white/10" />
                <DropdownMenuItem
                  className={itemClassName}
                  onSelect={(event) => {
                    event.preventDefault();
                    openPanel("share");
                  }}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Chia sẻ
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={itemClassName}
                  disabled={!canWrite || isMutating}
                  onSelect={(event) => {
                    event.preventDefault();
                    setMenuOpen(false);
                    setArchiveDialogOpen(true);
                  }}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Lưu trữ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="end"
          className={`${popoverWidthClassName} max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-xl border border-[#4a5160] bg-[#2f343d] p-0 text-slate-100 shadow-2xl`}
          sideOffset={8}
        >
          {activePanel === "move" ? (
            <CardMovePanel
              boardId={boardId}
              boardName={boardName}
              canWrite={canWrite}
              cardId={card.id}
              defaultListId={card.list_id}
              listOptions={listOptions}
              onOpenChange={(open) => {
                setActivePanel(open ? "move" : null);
              }}
              onOptimisticBoardChange={onOptimisticBoardChange}
              onOptimisticCardPatch={onOptimisticCardPatch}
              richnessQueryKey={richnessQueryKey}
              workspaceSlug={workspaceSlug}
            />
          ) : null}
          {activePanel === "copy" ? (
            <CardCopyOptionsDialog
              boardId={boardId}
              boardName={boardName}
              canWrite={canWrite}
              cardId={card.id}
              copySummary={copySummary}
              defaultListId={card.list_id}
              listOptions={listOptions}
              onOpenChange={(open) => {
                setActivePanel(open ? "copy" : null);
              }}
              onOptimisticBoardChange={onOptimisticBoardChange}
              richnessQueryKey={richnessQueryKey}
              sourceCard={card}
              workspaceSlug={workspaceSlug}
            />
          ) : null}
          {activePanel === "share" ? (
            <CardSharePanel
              boardId={boardId}
              cardId={card.id}
              cardTitle={card.title}
              onOpenChange={(open) => {
                setActivePanel(open ? "share" : null);
              }}
              workspaceSlug={workspaceSlug}
            />
          ) : null}
        </PopoverContent>
      </Popover>

      <Dialog onOpenChange={setArchiveDialogOpen} open={archiveDialogOpen}>
        <DialogContent className="w-[min(92vw,460px)] border border-slate-700/80 bg-[#1d2535] text-slate-100">
          <DialogTitle className="text-base font-semibold text-slate-100">Lưu trữ thẻ?</DialogTitle>
          <DialogDescription className="text-sm text-slate-300">
            Thẻ sẽ bị ẩn khỏi bảng và có thể khôi phục sau trong danh sách lưu trữ.
          </DialogDescription>
          <div className="flex justify-end">
            <Button
              className="h-9 border border-amber-600 bg-amber-900/35 px-3 text-sm font-semibold text-amber-100 hover:bg-amber-900/50"
              disabled={!canWrite || isMutating}
              onClick={() => {
                archiveMutation.mutate();
              }}
              type="button"
              variant="secondary"
            >
              {archiveMutation.isPending ? "Đang lưu trữ..." : "Lưu trữ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
