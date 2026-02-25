"use client";

import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { cn } from "@/shared";

import type { LabelRecord, WorkspaceMemberRecord } from "../types";
import {
  BOARD_FILTER_LABEL_NO_LABEL,
  BOARD_FILTER_MEMBER_ASSIGNED_TO_ME,
  BOARD_FILTER_MEMBER_NO_MEMBER,
  createDefaultBoardFilterState,
  hasActiveBoardFilters,
  parseBoardFilterStateFromSearchParams,
  writeBoardFilterStateToSearchParams,
  type BoardFilterActivityBucket,
  type BoardFilterCardStatus,
  type BoardFilterDueBucket,
  type BoardFilterMatchMode,
  type BoardFilterState,
} from "./board-filters";
import { BOARD_HERO_ICON_BUTTON_BASE_CLASS } from "./board-hero-toolbar-icon-button";
import {
  dispatchLocationChangeEvent,
  getLocationSearchSnapshot,
  subscribeToLocationChange,
} from "./board-location-change";
import { getInitials } from "./card-ui-utils";

type FilterToggleRowProps = {
  checked: boolean;
  description?: string;
  label: string;
  onToggle: () => void;
  preview?: ReactNode;
};

const STATUS_OPTIONS: Array<{ label: string; value: BoardFilterCardStatus }> = [
  { label: "Đã đánh dấu hoàn thành", value: "completed" },
  { label: "Không được đánh dấu là đã hoàn thành", value: "not-completed" },
];

const DUE_OPTIONS: Array<{ label: string; value: BoardFilterDueBucket }> = [
  { label: "Không có ngày hết hạn", value: "no-due-date" },
  { label: "Quá hạn", value: "overdue" },
  { label: "Sẽ hết hạn vào ngày mai", value: "due-tomorrow" },
  { label: "Sẽ hết hạn vào tuần sau", value: "due-next-7-days" },
  { label: "Sẽ hết hạn vào tháng sau", value: "due-next-30-days" },
];

const ACTIVITY_OPTIONS: Array<{ label: string; value: BoardFilterActivityBucket }> = [
  { label: "Hoạt động trong tuần qua", value: "active-1-week" },
  { label: "Hoạt động trong 2 tuần qua", value: "active-2-weeks" },
  { label: "Hoạt động trong 3 tuần qua", value: "active-3-weeks" },
  { label: "Không có hoạt động trong bốn tuần qua", value: "inactive-4-weeks" },
];

function FilterToggleRow({
  checked,
  description,
  label,
  onToggle,
  preview,
}: FilterToggleRowProps) {
  return (
    <button
      className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
      onClick={onToggle}
      type="button"
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-white",
          checked ? "border-sky-300 bg-sky-500/30" : "border-slate-400/90",
        )}
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-100">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-slate-300">{description}</span> : null}
      </span>
      {preview ? <span className="mt-0.5 shrink-0">{preview}</span> : null}
    </button>
  );
}

function FilterSectionTitle({ children }: { children: string }) {
  return <p className="px-2 text-xs font-semibold text-slate-300">{children}</p>;
}

function toggleValue(values: string[], targetValue: string): string[] {
  if (values.includes(targetValue)) {
    return values.filter((value) => value !== targetValue);
  }

  return [...values, targetValue];
}

function updateSearchParamsWithFilterState(params: {
  updater: (current: BoardFilterState) => BoardFilterState;
}) {
  const url = new URL(window.location.href);
  const searchParams = new URLSearchParams(url.search);
  const currentState = parseBoardFilterStateFromSearchParams(searchParams);
  const nextState = params.updater(currentState);
  writeBoardFilterStateToSearchParams(searchParams, nextState);

  const queryString = searchParams.toString();
  const nextPathWithQuery = queryString.length > 0 ? `${url.pathname}?${queryString}` : url.pathname;
  const nextUrl = url.hash.length > 0 ? `${nextPathWithQuery}${url.hash}` : nextPathWithQuery;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) {
    return;
  }

  window.history.replaceState(window.history.state, "", nextUrl);
  dispatchLocationChangeEvent();
}

// eslint-disable-next-line max-lines-per-function
export function BoardHeroFiltersButton({
  viewerId,
  workspaceLabels,
  workspaceMembers,
}: {
  viewerId: string;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
}) {
  const [open, setOpen] = useState(false);
  const searchSnapshot = useSyncExternalStore(
    subscribeToLocationChange,
    getLocationSearchSnapshot,
    () => "",
  );
  const filterState = useMemo(
    () => parseBoardFilterStateFromSearchParams(new URLSearchParams(searchSnapshot)),
    [searchSnapshot],
  );
  const isFilterActive = hasActiveBoardFilters(filterState);

  const updateFilterState = useCallback((updater: (current: BoardFilterState) => BoardFilterState) => {
    updateSearchParamsWithFilterState({ updater });
  }, []);

  const clearAllFilters = useCallback(() => {
    updateFilterState(() => createDefaultBoardFilterState());
  }, [updateFilterState]);

  const selectedMemberIds = new Set(filterState.members);
  const selectedStatusValues = new Set(filterState.statuses);
  const selectedDueValues = new Set(filterState.dueBuckets);
  const selectedLabelIds = new Set(filterState.labelIds);
  const selectedActivityValues = new Set(filterState.activityBuckets);

  const footerToggleClassName = filterState.collapseEmptyLists
    ? "border-sky-300/70 bg-sky-500/30 text-sky-100"
    : "border-slate-500/80 bg-transparent text-slate-300";

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Board filters"
          className={cn(
            BOARD_HERO_ICON_BUTTON_BASE_CLASS,
            isFilterActive ? "bg-white/18 text-white ring-1 ring-cyan-300/70" : "",
          )}
          type="button"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-[min(calc(100dvh-3.5rem),var(--radix-popover-content-available-height,calc(100dvh-3.5rem)))] w-[min(96vw,380px)] flex-col overflow-hidden border-[#4a5160] bg-[#2f343d] p-0 text-slate-100"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Lọc</p>
          </div>
          <div className="flex items-center gap-1">
            {isFilterActive ? (
              <button
                className="h-7 rounded-md px-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
                onClick={clearAllFilters}
                type="button"
              >
                Xóa
              </button>
            ) : null}
            <button
              aria-label="Đóng bộ lọc"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="board-menu-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-3">
          <div className="space-y-1.5 px-2">
            <p className="text-xs font-semibold text-slate-300">Từ khóa</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-9 w-full rounded-md border border-slate-500/80 bg-[#252a33] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-sky-400"
                onChange={(event) => {
                  const nextQuery = event.currentTarget.value;
                  updateFilterState((current) => ({ ...current, query: nextQuery }));
                }}
                placeholder="Nhập từ khóa..."
                value={filterState.query}
              />
            </div>
            <p className="text-xs text-slate-400">Tìm kiếm các thẻ, các thành viên, các nhãn và hơn thế nữa.</p>
          </div>

          <div className="space-y-1">
            <FilterSectionTitle>Thành viên</FilterSectionTitle>
            <FilterToggleRow
              checked={selectedMemberIds.has(BOARD_FILTER_MEMBER_NO_MEMBER)}
              label="Không có thành viên"
              onToggle={() => {
                updateFilterState((current) => ({
                  ...current,
                  members: toggleValue(current.members, BOARD_FILTER_MEMBER_NO_MEMBER),
                }));
              }}
            />
            <FilterToggleRow
              checked={selectedMemberIds.has(BOARD_FILTER_MEMBER_ASSIGNED_TO_ME)}
              label="Các thẻ đã chỉ định cho tôi"
              onToggle={() => {
                updateFilterState((current) => ({
                  ...current,
                  members: toggleValue(current.members, BOARD_FILTER_MEMBER_ASSIGNED_TO_ME),
                }));
              }}
              preview={(
                <Avatar className="h-5 w-5 border border-slate-700">
                  <AvatarFallback className="bg-emerald-600 text-[10px] text-white">
                    {getInitials(
                      workspaceMembers.find((entry) => entry.id === viewerId)?.displayName ?? "Me",
                    )}
                  </AvatarFallback>
                </Avatar>
              )}
            />
            {workspaceMembers.map((member) => (
              <FilterToggleRow
                checked={selectedMemberIds.has(member.id)}
                key={member.id}
                label={member.displayName}
                onToggle={() => {
                  updateFilterState((current) => ({
                    ...current,
                    members: toggleValue(current.members, member.id),
                  }));
                }}
                preview={(
                  <Avatar className="h-5 w-5 border border-slate-700">
                    {member.avatarUrl ? <AvatarImage alt={member.displayName} src={member.avatarUrl} /> : null}
                    <AvatarFallback className="bg-slate-700 text-[10px] text-slate-100">
                      {getInitials(member.displayName)}
                    </AvatarFallback>
                  </Avatar>
                )}
              />
            ))}
          </div>

          <div className="space-y-1">
            <FilterSectionTitle>Card status</FilterSectionTitle>
            {STATUS_OPTIONS.map((option) => (
              <FilterToggleRow
                checked={selectedStatusValues.has(option.value)}
                key={option.value}
                label={option.label}
                onToggle={() => {
                  updateFilterState((current) => ({
                    ...current,
                    statuses: toggleValue(current.statuses, option.value) as BoardFilterCardStatus[],
                  }));
                }}
              />
            ))}
          </div>

          <div className="space-y-1">
            <FilterSectionTitle>Ngày hết hạn</FilterSectionTitle>
            {DUE_OPTIONS.map((option) => (
              <FilterToggleRow
                checked={selectedDueValues.has(option.value)}
                key={option.value}
                label={option.label}
                onToggle={() => {
                  updateFilterState((current) => ({
                    ...current,
                    dueBuckets: toggleValue(current.dueBuckets, option.value) as BoardFilterDueBucket[],
                  }));
                }}
              />
            ))}
          </div>

          <div className="space-y-1">
            <FilterSectionTitle>Nhãn</FilterSectionTitle>
            <FilterToggleRow
              checked={selectedLabelIds.has(BOARD_FILTER_LABEL_NO_LABEL)}
              label="Không có Nhãn"
              onToggle={() => {
                updateFilterState((current) => ({
                  ...current,
                  labelIds: toggleValue(current.labelIds, BOARD_FILTER_LABEL_NO_LABEL),
                }));
              }}
            />
            {workspaceLabels.map((label) => (
              <FilterToggleRow
                checked={selectedLabelIds.has(label.id)}
                key={label.id}
                label={label.name || "Không tên"}
                onToggle={() => {
                  updateFilterState((current) => ({
                    ...current,
                    labelIds: toggleValue(current.labelIds, label.id),
                  }));
                }}
                preview={(
                  <span
                    className="h-4 w-16 rounded-sm border border-white/10"
                    style={{ backgroundColor: label.color }}
                    title={label.color}
                  />
                )}
              />
            ))}
          </div>

          <div className="space-y-1">
            <FilterSectionTitle>Activity</FilterSectionTitle>
            {ACTIVITY_OPTIONS.map((option) => (
              <FilterToggleRow
                checked={selectedActivityValues.has(option.value)}
                key={option.value}
                label={option.label}
                onToggle={() => {
                  updateFilterState((current) => ({
                    ...current,
                    activityBuckets: toggleValue(current.activityBuckets, option.value) as BoardFilterActivityBucket[],
                  }));
                }}
              />
            ))}
          </div>

          <div className="border-t border-white/10 pt-3">
            <button
              className={cn(
                "flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-sm transition hover:bg-white/10",
                footerToggleClassName,
              )}
              onClick={() => {
                updateFilterState((current) => ({
                  ...current,
                  collapseEmptyLists: !current.collapseEmptyLists,
                }));
              }}
              type="button"
            >
              <span>Thu gọn các danh sách không có thể trùng khớp</span>
              <span
                aria-hidden
                className={cn(
                  "inline-flex h-5 w-9 items-center rounded-full border px-0.5 transition",
                  filterState.collapseEmptyLists
                    ? "border-sky-300/70 bg-sky-500/30 justify-end"
                    : "border-slate-500/80 bg-slate-900/50 justify-start",
                )}
              >
                <span className="h-3.5 w-3.5 rounded-full bg-white" />
              </span>
            </button>
          </div>

          <div className="space-y-1 border-t border-white/10 pt-3">
            <FilterSectionTitle>Khớp</FilterSectionTitle>
            <div className="grid grid-cols-2 gap-1 px-2">
              {([
                { label: "Khớp bất kỳ", value: "any" },
                { label: "Khớp tất cả", value: "all" },
              ] as const).map((option) => (
                <button
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                    filterState.matchMode === option.value
                      ? "border-sky-300/70 bg-sky-500/30 text-sky-100"
                      : "border-slate-500/80 bg-[#252a33] text-slate-300 hover:bg-white/10",
                  )}
                  key={option.value}
                  onClick={() => {
                    updateFilterState((current) => ({
                      ...current,
                      matchMode: option.value as BoardFilterMatchMode,
                    }));
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
