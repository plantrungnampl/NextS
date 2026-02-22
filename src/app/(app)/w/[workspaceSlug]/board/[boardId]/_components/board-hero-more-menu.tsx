"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { APP_ROUTES } from "@/core";

import { archiveBoardInline, renameBoardInline } from "../actions.board-settings.inline";
import { updateBoardVisibilityInline } from "../actions.visibility.inline";
import type { BoardSettings, BoardVisibility, WorkspaceRole } from "../types";
import { BoardShareDialog } from "./board-share-dialog";
import {
  BoardHeroMoreMenuHeader,
  RootMenuView,
  SettingsMenuView,
  type MenuView,
  VISIBILITY_META,
  VisibilityMenuView,
} from "./board-hero-more-menu.views";
import {
  useBoardFavoriteQuery,
  useToggleBoardFavoriteMutation,
} from "./board-favorite-query";
import {
  useBoardSettingsQuery,
  useUpdateBoardSettingsMutation,
} from "./board-settings-query";
import { BOARD_HERO_ICON_BUTTON_BASE_CLASS } from "./board-hero-toolbar-icon-button";
import {
  buildBoardVisibilityQueryKey,
  type BoardVisibilityClientState,
} from "./board-visibility-query";

// eslint-disable-next-line max-lines-per-function
export function BoardHeroMoreMenu({
  boardDescription,
  boardId,
  boardName,
  canWriteBoard,
  initialIsFavorite,
  initialSettings,
  initialVisibility,
  role,
  workspaceName,
  workspaceSlug,
}: {
  boardDescription: string | null;
  boardId: string;
  boardName: string;
  canWriteBoard: boolean;
  initialIsFavorite: boolean;
  initialSettings: BoardSettings;
  initialVisibility: BoardVisibility;
  role: WorkspaceRole;
  workspaceName: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canWrite = canWriteBoard;
  const canManageSettings = role === "owner" || role === "admin";
  const [open, setOpen] = useState(false);
  const [activeView, setActiveView] = useState<MenuView>("root");
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [draftBoardName, setDraftBoardName] = useState(boardName);

  useEffect(() => {
    setDraftBoardName(boardName);
  }, [boardName]);

  const visibilityQueryKey = useMemo(
    () => buildBoardVisibilityQueryKey({ boardId, workspaceSlug }),
    [boardId, workspaceSlug],
  );
  const visibilityQuery = useQuery({
    initialData: initialVisibility,
    queryFn: () => {
      const cachedVisibility = queryClient.getQueryData<BoardVisibilityClientState>(visibilityQueryKey);
      return cachedVisibility ?? initialVisibility;
    },
    queryKey: visibilityQueryKey,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const visibility = visibilityQuery.data;
  const currentVisibilityLabel = VISIBILITY_META[visibility].label;

  const favoriteQuery = useBoardFavoriteQuery({
    boardId,
    initialIsFavorite,
  });
  const favoriteMutation = useToggleBoardFavoriteMutation({
    boardId,
    initialIsFavorite,
    workspaceSlug,
  });
  const isFavorite = favoriteQuery.data;

  const settingsQuery = useBoardSettingsQuery({
    boardId,
    initialSettings,
    workspaceSlug,
  });
  const settings = settingsQuery.data;
  const settingsMutation = useUpdateBoardSettingsMutation({
    boardId,
    initialSettings,
    workspaceSlug,
  });

  const visibilityMutation = useMutation({
    mutationFn: async (nextVisibility: BoardVisibilityClientState) =>
      updateBoardVisibilityInline({
        boardId,
        nextVisibility,
        workspaceSlug,
      }),
    onError: (_, __, context) => {
      queryClient.setQueryData(visibilityQueryKey, context?.previousVisibility ?? initialVisibility);
      toast.error("Không thể cập nhật quyền xem bảng.");
    },
    onMutate: async (nextVisibility: BoardVisibilityClientState) => {
      await queryClient.cancelQueries({ queryKey: visibilityQueryKey });
      const previousVisibility =
        queryClient.getQueryData<BoardVisibilityClientState>(visibilityQueryKey) ?? initialVisibility;
      queryClient.setQueryData(visibilityQueryKey, nextVisibility);
      return {
        previousVisibility,
      };
    },
    onSuccess: (result, _, context) => {
      if (!result.ok) {
        queryClient.setQueryData(visibilityQueryKey, context?.previousVisibility ?? initialVisibility);
        toast.error(result.error ?? "Không thể cập nhật quyền xem bảng.");
        return;
      }

      queryClient.setQueryData(visibilityQueryKey, result.visibility);
      if (result.visibility !== context?.previousVisibility) {
        toast.success("Đã cập nhật quyền xem bảng.");
      }
    },
  });

  const renameMutation = useMutation({
    mutationFn: async () =>
      renameBoardInline({
        boardId,
        name: draftBoardName,
        workspaceSlug,
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể đổi tên bảng.");
        return;
      }

      toast.success("Đã cập nhật tên bảng.");
      setDraftBoardName(result.name);
      router.refresh();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () =>
      archiveBoardInline({
        boardId,
        workspaceSlug,
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể lưu trữ bảng.");
        return;
      }

      toast.success("Đã lưu trữ bảng.");
      setOpen(false);
      setActiveView("root");
      router.push(APP_ROUTES.workspace.boardsBySlug(workspaceSlug));
    },
  });

  return (
    <>
      <Popover
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            void settingsMutation.flushNow();
          }
          if (!nextOpen) {
            setActiveView("root");
          }
        }}
        open={open}
      >
        <PopoverTrigger asChild>
          <button
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="More options"
            className={BOARD_HERO_ICON_BUTTON_BASE_CLASS}
            type="button"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="flex max-h-[min(calc(100dvh-3.5rem),var(--radix-popover-content-available-height,calc(100dvh-3.5rem)))] w-[min(96vw,360px)] flex-col overflow-hidden border-[#4a5160] bg-[#2f343d] p-0 text-slate-100"
        >
          <BoardHeroMoreMenuHeader
            onBack={activeView === "root" ? undefined : () => setActiveView("root")}
            onClose={() => {
              setOpen(false);
            }}
            title={activeView === "root" ? "Menu" : activeView === "visibility" ? "Khả năng hiển thị" : "Cài đặt"}
          />

          <div className="board-menu-scroll min-h-0 flex-1 overflow-y-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {activeView === "root" ? (
              <RootMenuView
                boardDescription={boardDescription}
                currentVisibilityLabel={currentVisibilityLabel}
                isFavorite={isFavorite}
                isFavoritePending={favoriteMutation.isPending}
                onOpenSettings={() => {
                  setActiveView("settings");
                }}
                onOpenShare={() => {
                  setOpen(false);
                  setIsShareOpen(true);
                }}
                onOpenVisibility={() => {
                  setActiveView("visibility");
                }}
                onToggleFavorite={() => {
                  if (favoriteMutation.isPending) {
                    return;
                  }

                  favoriteMutation.mutate(!isFavorite);
                }}
              />
            ) : null}
            {activeView === "visibility" ? (
              <VisibilityMenuView
                canWrite={canWrite}
                onSelect={(nextVisibility) => {
                  visibilityMutation.mutate(nextVisibility);
                }}
                pending={visibilityMutation.isPending}
                visibility={visibility}
              />
            ) : null}
            {activeView === "settings" ? (
              <SettingsMenuView
                archiveDisabled={!canWrite}
                canManageSettings={canManageSettings}
                isArchivePending={archiveMutation.isPending}
                isRenamePending={renameMutation.isPending}
                pendingSettingCount={settingsMutation.pendingKeys.length}
                settingsSaveError={settingsMutation.lastError}
                settingsSaveStatus={settingsMutation.saveStatus}
                nameValue={draftBoardName}
                onArchive={() => {
                  archiveMutation.mutate();
                }}
                onNameChange={setDraftBoardName}
                onRename={() => {
                  renameMutation.mutate();
                }}
                onSettingsPatch={(patch) => {
                  settingsMutation.applyOptimisticPatch(patch);
                }}
                renameDisabled={!canWrite || draftBoardName.trim().length === 0}
                settings={settings}
                workspaceName={workspaceName}
              />
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <BoardShareDialog
        boardId={boardId}
        hideTrigger
        onOpenChange={setIsShareOpen}
        open={isShareOpen}
        workspaceSlug={workspaceSlug}
      />
    </>
  );
}
