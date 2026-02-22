"use client";

import { AlertTriangle, Check } from "lucide-react";

import { Input, Label, SubmitButton, Textarea } from "@/components/ui";
import { cn } from "@/shared";

export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
};

export function BoardTitleField({
  boardName,
  setBoardName,
}: {
  boardName: string;
  setBoardName: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-300" htmlFor="board-title">
        Tiêu đề bảng *
      </Label>
      <Input
        className="min-h-11 border-slate-600 bg-[#151d27] text-slate-100 placeholder:text-slate-500"
        id="board-title"
        maxLength={160}
        name="name"
        onChange={(event) => {
          setBoardName(event.target.value);
        }}
        placeholder="VD: Sprint planning"
        required
        value={boardName}
      />
      <p className="text-[11px] text-slate-500">{boardName.length}/160 ký tự</p>
    </div>
  );
}

export function BoardDescriptionField({
  boardDescription,
  setBoardDescription,
}: {
  boardDescription: string;
  setBoardDescription: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-300" htmlFor="board-description">
        Mô tả
      </Label>
      <Textarea
        className="min-h-20 resize-none border-slate-600 bg-[#151d27] text-slate-100 placeholder:text-slate-500"
        id="board-description"
        maxLength={500}
        name="description"
        onChange={(event) => {
          setBoardDescription(event.target.value);
        }}
        placeholder="Ghi chú ngắn cho board"
        value={boardDescription}
      />
      <p className="text-[11px] text-slate-500">{boardDescription.length}/500 ký tự</p>
    </div>
  );
}

export function WorkspaceSelectField({
  setWorkspaceSlug,
  workspaceOptions,
  workspaceSlug,
}: {
  setWorkspaceSlug: (value: string) => void;
  workspaceOptions: WorkspaceOption[];
  workspaceSlug: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-300" htmlFor="board-workspace">
        Không gian làm việc
      </Label>
      <select
        className="h-11 w-full rounded-md border border-slate-600 bg-[#151d27] px-3 text-sm text-slate-100 outline-none transition-colors focus:border-sky-500 disabled:opacity-60"
        disabled={workspaceOptions.length === 0}
        id="board-workspace"
        name="workspaceSlugSelect"
        onChange={(event) => {
          setWorkspaceSlug(event.target.value);
        }}
        value={workspaceSlug}
      >
        {workspaceOptions.length > 0 ? (
          workspaceOptions.map((workspace) => (
            <option key={workspace.id} value={workspace.slug}>
              {workspace.name}
            </option>
          ))
        ) : (
          <option value="">No workspace</option>
        )}
      </select>
    </div>
  );
}

export function CreateBoardFeedback({
  canCreateBoard,
  createBoardMessage,
  createBoardType,
}: {
  canCreateBoard: boolean;
  createBoardMessage?: string;
  createBoardType?: string;
}) {
  const isSuccessMessage = createBoardType === "success";
  const MessageIcon = isSuccessMessage ? Check : AlertTriangle;

  return (
    <>
      {createBoardMessage ? (
        <p
          className={cn(
            "flex items-start gap-1.5 rounded-md px-2.5 py-2 text-xs",
            isSuccessMessage
              ? "border border-emerald-700/60 bg-emerald-900/30 text-emerald-200"
              : "border border-rose-800/60 bg-rose-950/40 text-rose-200",
          )}
        >
          <MessageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {createBoardMessage}
        </p>
      ) : null}
      {!canCreateBoard ? (
        <p className="rounded-md border border-amber-700/60 bg-amber-900/30 px-2 py-1.5 text-xs text-amber-200">
          Bạn cần có workspace để tạo board mới.
        </p>
      ) : null}
    </>
  );
}

export function CreateBoardActions({ canCreateBoard, onClose }: { canCreateBoard: boolean; onClose: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-700/70 pt-3 sm:flex-row sm:justify-end">
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-600 bg-[#1a2130] px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-[#232b3d]"
        onClick={onClose}
        type="button"
      >
        Hủy
      </button>
      <SubmitButton
        className="min-h-11 w-full bg-sky-600 text-white hover:bg-sky-500 sm:w-auto sm:min-w-[132px]"
        disabled={!canCreateBoard}
        pendingLabel="Đang tạo bảng..."
      >
        Tạo bảng
      </SubmitButton>
    </div>
  );
}
