"use client";

import {
  CalendarDays,
  Check,
  CheckSquare2,
  ChevronLeft,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  Search,
  SlidersHorizontal,
  Tag,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, type MouseEvent } from "react";
import { toast } from "sonner";

import type { LabelRecord } from "../types";
import { DEFAULT_LABEL_COLOR_ORDER, QUICK_LABEL_COLOR_PALETTE } from "../label-presets";
import type { QuickPanel } from "./card-quick-panel";

export type AddMenuItem = {
  action?: "open-attachments-panel" | "open-date-popover" | "open-members-panel";
  description: string;
  icon: LucideIcon;
  label: string;
  panel: QuickPanel;
  toastMessage?: string;
};

export const ADD_MENU_ITEMS: AddMenuItem[] = [
  { description: "Sắp xếp, phân loại và ưu tiên", icon: Tag, label: "Nhãn", panel: "labels" },
  {
    action: "open-date-popover",
    description: "Ngày bắt đầu, ngày hết hạn và lời nhắc",
    icon: CalendarDays,
    label: "Ngày",
    panel: null,
  },
  { description: "Thêm tác vụ con", icon: CheckSquare2, label: "Việc cần làm", panel: "checklist" },
  { action: "open-members-panel", description: "Chỉ định thành viên", icon: Users, label: "Thành viên", panel: null },
  {
    action: "open-attachments-panel",
    description: "Thêm liên kết, trang, hạng mục công việc, v.v.",
    icon: Paperclip,
    label: "Đính kèm",
    panel: null,
  },
  { description: "Xem thẻ này trên bản đồ", icon: MapPin, label: "Vị trí", panel: "more", toastMessage: "Vị trí sẽ sớm được hỗ trợ." },
  { description: "Tạo trường của riêng bạn", icon: SlidersHorizontal, label: "Trường tùy chỉnh", panel: null },
];

export function sortLabelsByPresetOrder(labels: LabelRecord[]): LabelRecord[] {
  return [...labels].sort((left, right) => {
    const leftIndex = DEFAULT_LABEL_COLOR_ORDER.indexOf(left.color.toLowerCase());
    const rightIndex = DEFAULT_LABEL_COLOR_ORDER.indexOf(right.color.toLowerCase());
    const normalizedLeft = leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex;
    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }
    return left.name.localeCompare(right.name);
  });
}

type AddMenuPanelProps = {
  onClose: () => void;
  onItemClick: (item: AddMenuItem, event: MouseEvent<HTMLButtonElement>) => void;
};

export function AddMenuPanel({ onClose, onItemClick }: AddMenuPanelProps) {
  return (
    <>
      <div className="flex items-center justify-center border-b border-white/10 px-4 py-3">
        <p className="text-base font-semibold">Thêm vào thẻ</p>
        <button
          aria-label="Đóng menu thêm"
          className="absolute right-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1 px-2 py-2">
        {ADD_MENU_ITEMS.map((item) => {
          const ItemIcon = item.icon;
          return (
            <button
              className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition hover:bg-white/10"
              key={item.label}
              onClick={(event) => onItemClick(item, event)}
              type="button"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-[#2a2d33] text-slate-300">
                <ItemIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-5 text-slate-100">{item.label}</span>
                <span className="mt-1 block text-xs leading-4 text-slate-400">{item.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

type LabelRowProps = {
  canWrite: boolean;
  isAssigned: boolean;
  isPending: boolean;
  label: LabelRecord;
  onEdit: () => void;
  onToggle: () => void;
};

function LabelRow({ canWrite, isAssigned, isPending, label, onEdit, onToggle }: LabelRowProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        aria-label={`${isAssigned ? "Bỏ chọn" : "Chọn"} nhãn ${label.name || label.color}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-slate-400/80 text-white transition hover:border-slate-100"
        disabled={!canWrite || isPending}
        onClick={onToggle}
        type="button"
      >
        {isAssigned ? <Check className="h-3.5 w-3.5" /> : null}
      </button>
      <button
        className="h-8 flex-1 rounded-sm transition hover:brightness-110"
        disabled={!canWrite || isPending}
        onClick={onToggle}
        style={{ backgroundColor: label.color }}
        title={label.name || label.color}
        type="button"
      />
      <button
        aria-label={`Chỉnh sửa nhãn ${label.name || label.color}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
        onClick={onEdit}
        type="button"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

type LabelsPanelProps = {
  canManageLabels: boolean;
  canWrite: boolean;
  getIsAssigned: (labelId: string) => boolean;
  isHydratingDefaults: boolean;
  labels: LabelRecord[];
  onBack: () => void;
  onClose: () => void;
  onCreateLabel: () => void;
  onQueryChange: (value: string) => void;
  onToggleLabel: (labelId: string) => void;
  pendingLabelIds: Record<string, boolean>;
  query: string;
};

export function LabelsPanel({
  canManageLabels,
  canWrite,
  getIsAssigned,
  isHydratingDefaults,
  labels,
  onBack,
  onClose,
  onCreateLabel,
  onQueryChange,
  onToggleLabel,
  pendingLabelIds,
  query,
}: LabelsPanelProps) {
  const filteredLabels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 1) {
      return labels;
    }
    return labels.filter((label) => label.name.toLowerCase().includes(normalizedQuery));
  }, [labels, query]);

  return (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button
          aria-label="Quay lại menu thêm"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-base font-semibold">Nhãn</p>
        <button
          aria-label="Đóng menu nhãn"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-9 w-full rounded-md border border-slate-600 bg-[#2a2d33] pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-[#8eb7ff]"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm nhãn..."
            value={query}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-300">Nhãn</p>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {isHydratingDefaults && filteredLabels.length < 1 ? (
              <div className="flex items-center justify-center rounded-md border border-slate-600 bg-[#2a2d33] p-3 text-xs text-slate-300">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Đang tải nhãn mặc định...
              </div>
            ) : filteredLabels.length > 0 ? (
              filteredLabels.map((label) => (
                <LabelRow
                  canWrite={canWrite}
                  isAssigned={getIsAssigned(label.id)}
                  isPending={Boolean(pendingLabelIds[label.id])}
                  key={label.id}
                  label={label}
                  onEdit={() => {
                    toast.info("Sửa nhãn sẽ sớm được hỗ trợ.");
                  }}
                  onToggle={() => onToggleLabel(label.id)}
                />
              ))
            ) : (
              <p className="rounded-md border border-slate-600 bg-[#2a2d33] px-3 py-2 text-xs text-slate-300">
                Chưa có nhãn nào trong workspace.
              </p>
            )}
          </div>
        </div>
        {canManageLabels ? (
          <button
            className="h-9 w-full rounded-md bg-slate-600/60 text-sm font-medium text-slate-100 transition hover:bg-slate-500/70"
            onClick={onCreateLabel}
            type="button"
          >
            Tạo nhãn mới
          </button>
        ) : null}
        <button
          className="h-9 w-full rounded-md bg-slate-600/40 text-sm font-medium text-slate-300 transition hover:bg-slate-500/50"
          onClick={() => {
            toast.info("Chế độ thân thiện màu sẽ sớm được hỗ trợ.");
          }}
          type="button"
        >
          Bật chế độ thân thiện với người mù màu
        </button>
      </div>
    </>
  );
}

type CreateLabelPanelProps = {
  canManageLabels: boolean;
  color: string | null;
  isCreating: boolean;
  name: string;
  onBack: () => void;
  onClose: () => void;
  onColorChange: (color: string) => void;
  onNameChange: (name: string) => void;
  onRemoveColor: () => void;
  onSubmit: () => void;
};

export function CreateLabelPanel({
  canManageLabels,
  color,
  isCreating,
  name,
  onBack,
  onClose,
  onColorChange,
  onNameChange,
  onRemoveColor,
  onSubmit,
}: CreateLabelPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button
          aria-label="Quay lại danh sách nhãn"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-base font-semibold">Tạo nhãn mới</p>
        <button
          aria-label="Đóng menu tạo nhãn"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 p-3">
        <div className="rounded-md border border-slate-600 bg-[#2a2d33] p-3">
          <div className="h-8 rounded-sm" style={{ backgroundColor: color ?? "#4b5563" }} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-300">Tiêu đề</p>
          <input
            className="h-9 w-full rounded-md border border-slate-600 bg-[#2a2d33] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-[#8eb7ff]"
            maxLength={50}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Nhập tên nhãn..."
            value={name}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-300">Chọn một màu</p>
          <div className="grid grid-cols-5 gap-1.5">
            {QUICK_LABEL_COLOR_PALETTE.map((paletteColor) => {
              const isActive = color?.toLowerCase() === paletteColor.toLowerCase();
              return (
                <button
                  className="relative h-8 rounded-sm transition hover:brightness-110"
                  key={paletteColor}
                  onClick={() => onColorChange(paletteColor)}
                  style={{ backgroundColor: paletteColor }}
                  type="button"
                >
                  {isActive ? <Check className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-black/80" /> : null}
                </button>
              );
            })}
          </div>
        </div>
        <button
          className="h-8 w-full rounded-md bg-slate-600/40 text-sm text-slate-200 transition hover:bg-slate-500/50"
          onClick={onRemoveColor}
          type="button"
        >
          × Gỡ bỏ màu
        </button>
        <button
          className="h-9 w-fit rounded-md bg-[#579dff] px-4 text-sm font-semibold text-slate-900 transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canManageLabels || isCreating}
          onClick={onSubmit}
          type="button"
        >
          {isCreating ? "Đang tạo..." : "Tạo mới"}
        </button>
      </div>
    </>
  );
}

type CreateChecklistPanelProps = {
  isSubmitting: boolean;
  title: string;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
  onTitleChange: (value: string) => void;
};

export function CreateChecklistPanel({
  isSubmitting,
  title,
  onBack,
  onClose,
  onSubmit,
  onTitleChange,
}: CreateChecklistPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button
          aria-label="Quay lại menu thêm"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-base font-semibold">Thêm danh sách công việc</p>
        <button
          aria-label="Đóng menu thêm checklist"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 p-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-300">Tiêu đề</p>
          <input
            className="h-9 w-full rounded-md border border-slate-600 bg-[#2a2d33] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-[#8eb7ff]"
            maxLength={120}
            onChange={(event) => onTitleChange(event.target.value)}
            value={title}
          />
        </div>
        <button
          className="h-9 w-fit rounded-md bg-[#579dff] px-4 text-sm font-semibold text-slate-900 transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || title.trim().length < 1}
          onClick={onSubmit}
          type="button"
        >
          {isSubmitting ? "Đang thêm..." : "Thêm"}
        </button>
      </div>
    </>
  );
}
