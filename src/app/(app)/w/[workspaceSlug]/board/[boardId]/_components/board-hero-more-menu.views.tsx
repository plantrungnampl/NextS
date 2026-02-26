"use client";
/* eslint-disable max-lines */

import {
  Archive,
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Eye,
  FilePlus2,
  Globe2,
  History,
  Info,
  Lock,
  Mail,
  Palette,
  Printer,
  Puzzle,
  Rows3,
  Settings,
  Share2,
  Star,
  Sticker,
  Tag,
  Users,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/shared";

import type { BoardPermissionLevel, BoardSettings } from "../types";
import type { BoardSettingsSaveStatus } from "./board-settings-query";
import type { BoardVisibilityClientState } from "./board-visibility-query";

export type MenuView = "root" | "settings" | "visibility";

type MenuRowActionProps = {
  disabled?: boolean;
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  onClick?: () => void;
  rowClassName?: string;
  subtitle?: string;
  trailing?: ReactNode;
};

const COMING_SOON_BADGE = (
  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold">Sắp có</span>
);
const PREMIUM_BADGE = (
  <span className="rounded bg-violet-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200">PREMIUM</span>
);
const favoriteActiveIconClass = "fill-current text-amber-300";
const favoriteInactiveIconClass = "text-slate-200";
const favoriteActiveSurfaceClass = "bg-white/8";

const VISIBILITY_OPTIONS: Array<{
  description: string;
  icon: LucideIcon;
  isDisabled?: boolean;
  label: string;
  value?: BoardVisibilityClientState;
}> = [
  {
    description:
      "Chỉ thành viên bảng và quản trị viên không gian làm việc mới có thể xem hoặc chỉnh sửa bảng.",
    icon: Lock,
    label: "Riêng tư",
    value: "private",
  },
  {
    description: "Tất cả thành viên không gian làm việc có thể xem và chỉnh sửa bảng này.",
    icon: Users,
    label: "Không gian làm việc",
    value: "workspace",
  },
  {
    description: "Bất kỳ ai có liên kết đều có thể xem bảng. Chỉ thành viên bảng mới có quyền sửa.",
    icon: Globe2,
    label: "Công khai",
    value: "public",
  },
  {
    description: "Sắp có trong phiên bản tiếp theo.",
    icon: Building2,
    isDisabled: true,
    label: "Tổ chức",
  },
];

const DISABLED_FEATURE_ITEMS: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Palette, label: "Thay đổi hình nền" },
  { icon: Rows3, label: "Trường tùy chỉnh" },
  { icon: WandSparkles, label: "Tự động hóa" },
  { icon: Puzzle, label: "Tiện ích bổ sung" },
  { icon: Tag, label: "Nhãn" },
  { icon: Sticker, label: "Các nhãn dán" },
  { icon: FilePlus2, label: "Tạo mẫu" },
  { icon: History, label: "Hoạt động" },
  { icon: Archive, label: "Mục đã lưu trữ" },
  { icon: Eye, label: "Theo dõi" },
  { icon: Rows3, label: "Thu gọn tất cả danh sách" },
  { icon: Copy, label: "Sao chép bảng thông tin" },
  { icon: Mail, label: "Cài đặt Email-tới-bảng" },
];

export const VISIBILITY_META: Record<BoardVisibilityClientState, { icon: LucideIcon; label: string }> = {
  private: { icon: Lock, label: "Riêng tư" },
  public: { icon: Globe2, label: "Công khai" },
  workspace: { icon: Users, label: "Không gian làm việc" },
};

const PERMISSION_META: Record<BoardPermissionLevel, { description: string; label: string }> = {
  admins: {
    description: "Chỉ quản trị viên bảng hoặc quản trị viên không gian làm việc.",
    label: "Quản trị viên",
  },
  members: {
    description: "Mọi thành viên bảng đều có thể thao tác.",
    label: "Thành viên",
  },
};

function MenuRowAction({
  disabled = false,
  icon: Icon,
  iconClassName,
  label,
  onClick,
  rowClassName,
  subtitle,
  trailing,
}: MenuRowActionProps) {
  return (
    <button
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
        rowClassName,
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-200">
        <Icon className={cn("h-4 w-4", iconClassName)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-slate-100">{label}</span>
        {subtitle ? <span className="mt-0.5 block text-xs text-slate-300">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="inline-flex shrink-0 items-center text-slate-300">{trailing}</span> : null}
    </button>
  );
}

function MenuRowDisabled({
  icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return <MenuRowAction disabled icon={icon} label={label} trailing={COMING_SOON_BADGE} />;
}

function MenuSectionDivider() {
  return <div className="my-1 h-px bg-white/10" />;
}

function SettingsSectionTitle({ title }: { title: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{title}</p>;
}

function PermissionSelectorRow({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (nextValue: BoardPermissionLevel) => void;
  value: BoardPermissionLevel;
}) {
  return (
    <div className="space-y-1.5 rounded-md border border-white/10 bg-white/[0.02] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-100">{label}</p>
        <div className="flex items-center rounded-md border border-white/15 bg-black/20 p-0.5">
          {(["members", "admins"] as BoardPermissionLevel[]).map((level) => {
            const isActive = value === level;
            return (
              <button
                className={cn(
                  "h-7 rounded px-2 text-[11px] font-semibold transition",
                  isActive
                    ? "bg-white/15 text-slate-100"
                    : "text-slate-300 hover:bg-white/10 hover:text-slate-100",
                )}
                disabled={disabled}
                key={level}
                onClick={() => {
                  if (isActive) {
                    return;
                  }
                  onChange(level);
                }}
                type="button"
              >
                {PERMISSION_META[level].label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-slate-300">{PERMISSION_META[value].description}</p>
    </div>
  );
}

function ToggleSettingRow({
  description,
  disabled,
  icon: Icon,
  label,
  onToggle,
  value,
}: {
  description: string;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  onToggle: () => void;
  value: boolean;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md border border-white/10 px-2.5 py-2 text-left transition",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
      )}
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-200">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-100">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-300">{description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border",
          value ? "border-emerald-300/70 bg-emerald-500/20 text-emerald-200" : "border-white/20 text-transparent",
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

export function BoardHeroMoreMenuHeader({
  onBack,
  onClose,
  title,
}: {
  onBack?: () => void;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
      <div className="flex min-w-0 items-center gap-1">
        {onBack ? (
          <button
            aria-label="Quay lại"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
      </div>
      <button
        aria-label="Đóng"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
        onClick={onClose}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function RootMenuView({
  boardDescription,
  canManageAccess,
  canManageSettings,
  currentVisibilityLabel,
  isFavorite,
  isFavoritePending,
  onOpenSettings,
  onOpenShare,
  onOpenVisibility,
  onToggleFavorite,
}: {
  boardDescription: string | null;
  canManageAccess: boolean;
  canManageSettings: boolean;
  currentVisibilityLabel: string;
  isFavorite: boolean;
  isFavoritePending: boolean;
  onOpenSettings: () => void;
  onOpenShare: () => void;
  onOpenVisibility: () => void;
  onToggleFavorite: () => void;
}) {
  const boardAboutSubtitle = boardDescription?.trim().length
    ? boardDescription
    : "Thêm mô tả vào bảng của bạn";

  return (
    <div className="space-y-1 px-2 py-2">
      <MenuRowAction
        disabled={!canManageAccess}
        icon={Share2}
        label="Chia sẻ"
        onClick={onOpenShare}
      />
      <MenuRowAction disabled icon={Info} label="Về bảng này" subtitle={boardAboutSubtitle} trailing={COMING_SOON_BADGE} />
      <MenuRowAction
        disabled={!canManageSettings}
        icon={Users}
        label={`Khả năng hiển thị: ${currentVisibilityLabel}`}
        onClick={onOpenVisibility}
      />
      <MenuRowDisabled icon={Printer} label="In, xuất và chia sẻ" />
      <MenuRowAction
        disabled={isFavoritePending}
        icon={Star}
        iconClassName={isFavorite ? favoriteActiveIconClass : favoriteInactiveIconClass}
        label="Gắn sao"
        onClick={onToggleFavorite}
        rowClassName={isFavorite ? favoriteActiveSurfaceClass : ""}
        subtitle={isFavorite ? "Đã gắn sao" : undefined}
      />

      <MenuSectionDivider />
      <MenuRowAction icon={Settings} label="Cài đặt" onClick={onOpenSettings} />

      <MenuSectionDivider />
      {DISABLED_FEATURE_ITEMS.map((item) => (
        <MenuRowDisabled icon={item.icon} key={item.label} label={item.label} />
      ))}
    </div>
  );
}

export function VisibilityMenuView({
  canManage,
  onSelect,
  pending,
  visibility,
}: {
  canManage: boolean;
  onSelect: (nextVisibility: BoardVisibilityClientState) => void;
  pending: boolean;
  visibility: BoardVisibilityClientState;
}) {
  return (
    <div className="space-y-1 px-2 py-2">
      {VISIBILITY_OPTIONS.map((option) => {
        const isCurrent = option.value ? option.value === visibility : false;
        const isDisabled = option.isDisabled || !option.value || !canManage || pending;

        return (
          <MenuRowAction
            disabled={isDisabled}
            icon={option.icon}
            key={option.label}
            label={option.label}
            onClick={() => {
              if (!option.value || option.value === visibility) {
                return;
              }
              onSelect(option.value);
            }}
            subtitle={option.description}
            trailing={isCurrent ? <Check className="h-4 w-4" /> : null}
          />
        );
      })}
      {!canManage ? (
        <p className="border-t border-white/10 px-2.5 pt-2 text-xs text-slate-300">Bạn chỉ có quyền xem.</p>
      ) : null}
    </div>
  );
}

// eslint-disable-next-line max-lines-per-function
export function SettingsMenuView({
  archiveDisabled,
  canManageSettings,
  isArchivePending,
  isRenamePending,
  nameValue,
  onArchive,
  onNameChange,
  onRename,
  onSettingsPatch,
  pendingSettingCount,
  renameDisabled,
  settings,
  settingsSaveError,
  settingsSaveStatus,
  workspaceName,
}: {
  archiveDisabled: boolean;
  canManageSettings: boolean;
  isArchivePending: boolean;
  isRenamePending: boolean;
  nameValue: string;
  onArchive: () => void;
  onNameChange: (nextValue: string) => void;
  onRename: () => void;
  onSettingsPatch: (patch: Partial<BoardSettings>) => void;
  pendingSettingCount: number;
  renameDisabled: boolean;
  settings: BoardSettings;
  settingsSaveError: string | null;
  settingsSaveStatus: BoardSettingsSaveStatus;
  workspaceName: string;
}) {
  const settingsControlDisabled = !canManageSettings;
  const settingsStatusText = (() => {
    if (settingsSaveStatus === "saving") {
      if (pendingSettingCount > 1) {
        return `Đang lưu ${pendingSettingCount} thay đổi...`;
      }
      return "Đang lưu thay đổi...";
    }
    if (settingsSaveStatus === "saved") {
      return "Đã lưu";
    }
    if (settingsSaveStatus === "error") {
      return settingsSaveError ?? "Một số thay đổi chưa lưu.";
    }
    return null;
  })();
  const settingsStatusClassName =
    settingsSaveStatus === "error"
      ? "border-rose-300/35 bg-rose-900/25 text-rose-100"
      : settingsSaveStatus === "saved"
        ? "border-emerald-300/35 bg-emerald-900/20 text-emerald-100"
        : "border-sky-300/30 bg-sky-900/20 text-sky-100";

  return (
    <div className="space-y-3 px-3 py-3">
      {settingsStatusText ? (
        <p className={cn("rounded-md border px-2.5 py-2 text-xs", settingsStatusClassName)}>{settingsStatusText}</p>
      ) : null}

      <div className="space-y-1.5">
        <SettingsSectionTitle title="Không gian làm việc" />
        <p className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-slate-100">
          {workspaceName}
        </p>
      </div>

      <div className="space-y-2">
        <SettingsSectionTitle title="Quyền" />
        <PermissionSelectorRow
          disabled={settingsControlDisabled}
          label="Nhận xét"
          onChange={(nextValue) => {
            onSettingsPatch({ commentPermission: nextValue });
          }}
          value={settings.commentPermission}
        />
        <PermissionSelectorRow
          disabled={settingsControlDisabled}
          label="Thêm và xóa thành viên"
          onChange={(nextValue) => {
            onSettingsPatch({ memberManagePermission: nextValue });
          }}
          value={settings.memberManagePermission}
        />
        <PermissionSelectorRow
          disabled={settingsControlDisabled}
          label="Chỉnh sửa bảng"
          onChange={(nextValue) => {
            onSettingsPatch({ editPermission: nextValue });
          }}
          value={settings.editPermission}
        />
      </div>

      <div className="space-y-2">
        <SettingsSectionTitle title="Trạng thái hoàn tất" />
        <ToggleSettingRow
          description="Hiển thị trạng thái hoàn tất ở mặt trước thẻ."
          disabled={settingsControlDisabled}
          icon={Check}
          label="Hiển thị trạng thái hoàn tất ở mặt trước thẻ"
          onToggle={() => {
            onSettingsPatch({ showCompleteStatusOnFront: !settings.showCompleteStatusOnFront });
          }}
          value={settings.showCompleteStatusOnFront}
        />
      </div>

      <div className="space-y-2">
        <SettingsSectionTitle title="Ảnh bìa" />
        <ToggleSettingRow
          description="Hiển thị tệp đính kèm hình ảnh và màu sắc ở mặt trước thẻ."
          disabled={settingsControlDisabled}
          icon={Palette}
          label="Hiển thị ảnh bìa ở mặt trước thẻ"
          onToggle={() => {
            onSettingsPatch({ showCardCoverOnFront: !settings.showCardCoverOnFront });
          }}
          value={settings.showCardCoverOnFront}
        />
      </div>

      <div className="space-y-1.5">
        <SettingsSectionTitle title="Bộ sưu tập" />
        <MenuRowAction disabled icon={Building2} label="Thêm vào bộ sưu tập" trailing={PREMIUM_BADGE} />
      </div>

      {!canManageSettings ? (
        <p className="rounded-md border border-amber-300/30 bg-amber-900/20 px-2.5 py-2 text-xs text-amber-100">
          Bạn không có quyền chỉnh mục này.
        </p>
      ) : null}

      <MenuSectionDivider />

      <div className="space-y-3">
        <div className="space-y-1.5">
          <SettingsSectionTitle title="Đổi tên bảng" />
          <input
            className="h-10 w-full rounded-md border border-slate-500/70 bg-[#252a33] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-sky-400"
            onChange={(event) => {
              onNameChange(event.currentTarget.value);
            }}
            placeholder="Nhập tên bảng"
            value={nameValue}
          />
          <button
            className="h-9 w-full rounded-md bg-sky-500 px-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={renameDisabled || isRenamePending}
            onClick={onRename}
            type="button"
          >
            {isRenamePending ? "Đang lưu..." : "Lưu tên bảng"}
          </button>
        </div>

        <div className="space-y-1.5">
          <SettingsSectionTitle title="Lưu trữ bảng" />
          <button
            className="h-9 w-full rounded-md border border-rose-700 bg-rose-900/30 px-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={archiveDisabled || isArchivePending}
            onClick={onArchive}
            type="button"
          >
            {isArchivePending ? "Đang lưu trữ..." : "Lưu trữ bảng"}
          </button>
        </div>
      </div>
    </div>
  );
}
