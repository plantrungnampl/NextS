"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  LayoutGrid,
  Palette,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/shared";
import { createBoard } from "../actions";
import {
  BoardDescriptionField,
  BoardTitleField,
  CreateBoardActions,
  CreateBoardFeedback,
  WorkspaceSelectField,
  type WorkspaceOption,
} from "./create-board-modal.form-sections";
import {
  BOARD_BACKGROUNDS,
  MODAL_QUERY_KEYS,
  VISIBILITY_OPTIONS,
  type VisibilityValue,
} from "./create-board-modal.config";

type CreateBoardModalProps = {
  createBoardMessage?: string;
  createBoardType?: string;
  defaultWorkspaceSlug?: string;
  isOpen: boolean;
  workspaceOptions: WorkspaceOption[];
};
function BoardPreview({
  boardName,
  style,
  visibility,
  workspaceName,
}: {
  boardName: string;
  style: CSSProperties;
  visibility: VisibilityValue;
  workspaceName: string | undefined;
}) {
  const visibilityLabel = VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ?? "Workspace";
  const previewName = boardName.trim().length > 0 ? boardName : "Tên bảng của bạn";

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-500/60 p-3 shadow-lg" style={style}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-medium text-white/95">
            <LayoutGrid className="h-3 w-3" />
            {visibilityLabel}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/75">
            {workspaceName ?? "Workspace"}
          </span>
        </div>
        <p className="line-clamp-1 text-sm font-semibold text-white">{previewName}</p>
        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-black/30 p-1.5">
          <div className="h-11 rounded-md bg-white/85" />
          <div className="h-11 rounded-md bg-white/80" />
          <div className="h-11 rounded-md bg-white/85" />
        </div>
      </div>
    </div>
  );
}
function BackgroundPicker({
  selectedBackgroundId,
  setSelectedBackgroundId,
}: {
  selectedBackgroundId: string;
  setSelectedBackgroundId: (value: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-sky-300" />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Phông nền</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {BOARD_BACKGROUNDS.map((background) => (
          <button
            aria-label={background.label}
            aria-pressed={selectedBackgroundId === background.id}
            className={cn(
              "group relative h-12 rounded-lg border border-transparent transition-all hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
              selectedBackgroundId === background.id
                ? "border-sky-300 ring-2 ring-sky-400/70"
                : "border-white/20 hover:border-slate-300/50",
            )}
            key={background.id}
            onClick={() => {
              setSelectedBackgroundId(background.id);
            }}
            style={background.style}
            type="button"
          >
            <span className="sr-only">{background.label}</span>
            <span
              className={cn(
                "absolute inset-0 rounded-lg bg-gradient-to-r opacity-90 transition-opacity group-hover:opacity-100",
                background.previewClassName,
              )}
            />
            {selectedBackgroundId === background.id ? (
              <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white">
                <Check className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
function ModalTabs() {
  const tabs = [
    { label: "Bảng", value: "active" },
    { label: "Thành viên", value: "inactive" },
    { label: "Cài đặt", value: "inactive" },
  ] as const;

  return (
    <div className="flex items-center gap-1 rounded-lg bg-[#242a38] p-1 text-xs text-slate-300">
      {tabs.map((tab) => (
        <span
          className={cn(
            "rounded-md px-2.5 py-1.5 transition-colors",
            tab.value === "active" ? "bg-[#3b4660] font-semibold text-slate-100" : "text-slate-400",
          )}
          key={tab.label}
        >
          {tab.label}
        </span>
      ))}
    </div>
  );
}
function getResolvedWorkspaceSlug(workspaces: WorkspaceOption[], defaultWorkspaceSlug?: string): string {
  if (defaultWorkspaceSlug && workspaces.some((workspace) => workspace.slug === defaultWorkspaceSlug)) {
    return defaultWorkspaceSlug;
  }

  return workspaces[0]?.slug ?? "";
}
function VisibilityPicker({
  selectedVisibility,
  setSelectedVisibility,
}: {
  selectedVisibility: VisibilityValue;
  setSelectedVisibility: (value: VisibilityValue) => void;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Quyền xem</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {VISIBILITY_OPTIONS.map((option) => {
          const isSelected = selectedVisibility === option.value;
          const Icon = option.icon;
          return (
            <button
              aria-pressed={isSelected}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                isSelected
                  ? "border-sky-400 bg-sky-900/25 text-slate-100"
                  : "border-slate-600 bg-[#171d29] text-slate-300 hover:border-slate-500 hover:bg-[#1d2432]",
              )}
              key={option.value}
              onClick={() => {
                setSelectedVisibility(option.value);
              }}
              type="button"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-slate-400">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function CreateBoardForm({
  boardDescription,
  boardName,
  canCreateBoard,
  createBoardMessage,
  createBoardType,
  onClose,
  selectedBackgroundId,
  selectedBackgroundStyle,
  selectedVisibility,
  setBoardDescription,
  setBoardName,
  setSelectedBackgroundId,
  setSelectedVisibility,
  setWorkspaceSlug,
  workspaceOptions,
  workspaceSlug,
}: {
  boardDescription: string;
  boardName: string;
  canCreateBoard: boolean;
  createBoardMessage?: string;
  createBoardType?: string;
  onClose: () => void;
  selectedBackgroundId: string;
  selectedBackgroundStyle: CSSProperties;
  selectedVisibility: VisibilityValue;
  setBoardDescription: (value: string) => void;
  setBoardName: (value: string) => void;
  setSelectedBackgroundId: (value: string) => void;
  setSelectedVisibility: (value: VisibilityValue) => void;
  setWorkspaceSlug: (value: string) => void;
  workspaceOptions: WorkspaceOption[];
  workspaceSlug: string;
}) {
  const selectedWorkspaceName = workspaceOptions.find((workspace) => workspace.slug === workspaceSlug)?.name;

  return (
    <form action={createBoard} className="mt-4 space-y-4">
      <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
      <input name="background" type="hidden" value={selectedBackgroundId} />
      <input name="visibility" type="hidden" value={selectedVisibility} />

      <BoardPreview
        boardName={boardName}
        style={selectedBackgroundStyle}
        visibility={selectedVisibility}
        workspaceName={selectedWorkspaceName}
      />
      <BackgroundPicker selectedBackgroundId={selectedBackgroundId} setSelectedBackgroundId={setSelectedBackgroundId} />
      <BoardTitleField boardName={boardName} setBoardName={setBoardName} />
      <BoardDescriptionField boardDescription={boardDescription} setBoardDescription={setBoardDescription} />
      <VisibilityPicker selectedVisibility={selectedVisibility} setSelectedVisibility={setSelectedVisibility} />
      <WorkspaceSelectField
        setWorkspaceSlug={setWorkspaceSlug}
        workspaceOptions={workspaceOptions}
        workspaceSlug={workspaceSlug}
      />
      <CreateBoardFeedback
        canCreateBoard={canCreateBoard}
        createBoardMessage={createBoardMessage}
        createBoardType={createBoardType}
      />
      <CreateBoardActions canCreateBoard={canCreateBoard} onClose={onClose} />
    </form>
  );
}
export function CreateBoardModal({
  createBoardMessage,
  createBoardType,
  defaultWorkspaceSlug,
  isOpen,
  workspaceOptions,
}: CreateBoardModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedWorkspaceSlug = useMemo(
    () => getResolvedWorkspaceSlug(workspaceOptions, defaultWorkspaceSlug),
    [defaultWorkspaceSlug, workspaceOptions],
  );
  const [workspaceSlug, setWorkspaceSlug] = useState(resolvedWorkspaceSlug);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState(BOARD_BACKGROUNDS[0].id);
  const [selectedVisibility, setSelectedVisibility] = useState<VisibilityValue>("workspace");
  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const closeModal = useCallback(() => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    for (const key of MODAL_QUERY_KEYS) {
      nextSearchParams.delete(key);
    }

    const queryString = nextSearchParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }, [pathname, router, searchParams]);
  useEffect(() => {
    setWorkspaceSlug(resolvedWorkspaceSlug);
  }, [resolvedWorkspaceSlug]);
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedVisibility("workspace");
    setBoardName("");
    setBoardDescription("");
    setSelectedBackgroundId(BOARD_BACKGROUNDS[0].id);
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [closeModal, isOpen]);
  if (!isOpen) {
    return null;
  }
  const selectedBackground =
    BOARD_BACKGROUNDS.find((background) => background.id === selectedBackgroundId) ?? BOARD_BACKGROUNDS[0];
  const canCreateBoard = workspaceOptions.length > 0 && workspaceSlug.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 px-4 py-8 backdrop-blur-sm sm:py-14"
      onClick={closeModal}
    >
      <div
        className="mx-auto w-full max-w-[520px] rounded-2xl border border-slate-600/70 bg-[#1b2230] p-4 text-slate-100 shadow-2xl sm:p-5"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <ModalTabs />

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-200">
              <Sparkles className="h-3 w-3" />
              Create board
            </p>
            <h2 className="text-base font-semibold text-slate-100">Tạo bảng mới</h2>
            <p className="text-xs text-slate-400">
              Chọn giao diện và thông tin cơ bản trước khi tạo bảng.
            </p>
          </div>
          <button
            aria-label="Đóng modal tạo bảng"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-100"
            onClick={closeModal}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <CreateBoardForm
          boardDescription={boardDescription}
          boardName={boardName}
          canCreateBoard={canCreateBoard}
          createBoardMessage={createBoardMessage}
          createBoardType={createBoardType}
          onClose={closeModal}
          selectedBackgroundId={selectedBackgroundId}
          selectedBackgroundStyle={selectedBackground.style}
          selectedVisibility={selectedVisibility}
          setBoardDescription={setBoardDescription}
          setBoardName={setBoardName}
          setSelectedBackgroundId={setSelectedBackgroundId}
          setSelectedVisibility={setSelectedVisibility}
          setWorkspaceSlug={setWorkspaceSlug}
          workspaceOptions={workspaceOptions}
          workspaceSlug={workspaceSlug}
        />
      </div>
    </div>
  );
}
