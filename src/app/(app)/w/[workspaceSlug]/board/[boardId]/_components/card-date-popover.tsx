"use client";
/* eslint-disable max-lines */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock3, Repeat, TimerReset } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";

import {
  Button,
  Calendar,
  Input,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { cn } from "@/shared";

import { updateCardScheduleInline } from "../actions.card-modal";
import type { CardRecord } from "../types";
import type { DatePopoverAnchorRect } from "./card-date-popover-anchor";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";
import {
  formatDueDateLabel,
  getDueDateStatusLabel,
  getDueDateStatusSelectedDayClass,
  getDueDateStatusSurfaceClass,
  getDueDateStatusWithContext,
} from "./card-ui-utils";
import {
  buildIsoFromDraft,
  detectTimezone,
  DUE_DATE_LEGEND_ITEMS,
  forceScrollableWheel,
  parseIsoToDraft,
  RECURRENCE_PRESETS,
  REMINDER_PRESETS,
  toLocalDateValue,
} from "./card-date-popover-utils";

type CardDatePopoverProps = {
  anchorRect?: DatePopoverAnchorRect;
  boardId: string;
  buttonClassName: string;
  canWrite: boolean;
  card: CardRecord;
  onOpenChange?: (open: boolean) => void;
  onOptimisticCardPatch?: (patch: {
    due_at: string | null;
    has_due_time: boolean;
    has_start_time: boolean;
    recurrence_anchor_at: string | null;
    recurrence_rrule: string | null;
    recurrence_tz: string | null;
    reminder_offset_minutes: number | null;
    start_at: string | null;
  }) => void;
  openOrigin?: "chip" | "quick-add";
  open?: boolean;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
};

// eslint-disable-next-line max-lines-per-function
export function CardDatePopover({
  anchorRect,
  boardId,
  buttonClassName,
  canWrite,
  card,
  onOpenChange,
  onOptimisticCardPatch,
  open,
  openOrigin = "chip",
  richnessQueryKey,
  workspaceSlug,
}: CardDatePopoverProps) {
  const queryClient = useQueryClient();
  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId: card.id,
    workspaceSlug,
  });
  const initialStartDraft = useMemo(
    () => parseIsoToDraft(card.start_at, card.has_start_time),
    [card.has_start_time, card.start_at],
  );
  const initialDueDraft = useMemo(
    () => parseIsoToDraft(card.due_at, card.has_due_time),
    [card.due_at, card.has_due_time],
  );

  const [internalDatePopoverOpen, setInternalDatePopoverOpen] = useState(false);
  const isDatePopoverControlled = typeof open === "boolean";
  const isDatePopoverOpen = isDatePopoverControlled ? open : internalDatePopoverOpen;
  const setDatePopoverOpen = (nextOpen: boolean) => {
    if (!isDatePopoverControlled) {
      setInternalDatePopoverOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isDueCalendarOpen, setIsDueCalendarOpen] = useState(false);
  const [hasStartDate, setHasStartDate] = useState(initialStartDraft.hasDate);
  const [startDate, setStartDate] = useState<Date | undefined>(initialStartDraft.date);
  const [hasStartTime, setHasStartTime] = useState(initialStartDraft.hasTime);
  const [startTime, setStartTime] = useState(initialStartDraft.time);

  const [hasDueDate, setHasDueDate] = useState(initialDueDraft.hasDate);
  const [dueDate, setDueDate] = useState<Date | undefined>(initialDueDraft.date);
  const [hasDueTime, setHasDueTime] = useState(initialDueDraft.hasTime);
  const [dueTime, setDueTime] = useState(initialDueDraft.time);

  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState(
    card.reminder_offset_minutes !== null ? String(card.reminder_offset_minutes) : "",
  );
  const [recurrencePreset, setRecurrencePreset] = useState(() => {
    const currentRule = (card.recurrence_rrule ?? "").toUpperCase();
    const matchedPreset = RECURRENCE_PRESETS.find(
      (preset) => preset.value !== "CUSTOM" && preset.value === currentRule,
    );
    if (matchedPreset) {
      return matchedPreset.value;
    }

    return currentRule.length > 0 ? "CUSTOM" : "";
  });
  const [customRecurrenceRule, setCustomRecurrenceRule] = useState(
    card.recurrence_rrule ?? "",
  );

  const dueAtIso = buildIsoFromDraft({
    date: dueDate,
    hasDate: hasDueDate,
    hasTime: hasDueTime,
    time: dueTime,
  });
  const startAtIso = buildIsoFromDraft({
    date: startDate,
    hasDate: hasStartDate,
    hasTime: hasStartTime,
    time: startTime,
  });
  const recurrenceRRule =
    recurrencePreset === "CUSTOM"
      ? customRecurrenceRule.trim().toUpperCase()
      : recurrencePreset;
  const timezone = detectTimezone();
  const dueDateStatus = getDueDateStatusWithContext(hasDueDate ? dueAtIso : null, {
    isCompleted: card.is_completed,
  });
  const dueDateStatusLabel = getDueDateStatusLabel(dueDateStatus);
  const dueDateSurfaceClass = getDueDateStatusSurfaceClass(dueDateStatus);
  const dueSelectedDayClass = getDueDateStatusSelectedDayClass(dueDateStatus);
  const startSelectedDayClass = "bg-sky-600 text-white hover:bg-sky-600";
  const shouldUseQuickAddAnchor = openOrigin === "quick-add" && Boolean(anchorRect);
  const popoverMaxHeightClass = shouldUseQuickAddAnchor
    ? "max-h-[min(520px,var(--radix-popover-content-available-height,520px))]"
    : "max-h-[min(700px,var(--radix-popover-content-available-height,700px))]";
  const contentBodyRef = useRef<HTMLDivElement | null>(null);
  const quickAddVirtualAnchorRef = useMemo<RefObject<{
    getBoundingClientRect: () => DOMRect;
  }> | undefined>(() => {
    if (!shouldUseQuickAddAnchor || !anchorRect) {
      return undefined;
    }

    return {
      current: {
        getBoundingClientRect: () =>
          new DOMRect(anchorRect.left, anchorRect.top, anchorRect.width, anchorRect.height),
      },
    } as RefObject<{
      getBoundingClientRect: () => DOMRect;
    }>;
  }, [anchorRect, shouldUseQuickAddAnchor]);
  useEffect(() => {
    if (!isDatePopoverOpen) {
      return;
    }
    contentBodyRef.current?.scrollTo({ top: 0 });
  }, [isDatePopoverOpen]);
  const handleScrollBodyWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    forceScrollableWheel(event);
  };
  const scheduleMutation = useMutation({
    mutationKey: [...modalMutationKey, "schedule"],
    mutationFn: async (payload: {
      closeOnSuccess: boolean;
      dueAtIso: string;
      hasDueTime: boolean;
      hasStartTime: boolean;
      recurrenceRRule: string;
      recurrenceTz: string;
      reminderOffsetMinutes: string;
      startAtIso: string;
    }) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", card.id);
      formData.set("dueAtIso", payload.dueAtIso);
      formData.set("startAtIso", payload.startAtIso);
      formData.set("hasDueTime", String(payload.hasDueTime));
      formData.set("hasStartTime", String(payload.hasStartTime));
      formData.set("recurrenceRRule", payload.recurrenceRRule);
      formData.set("recurrenceTz", payload.recurrenceTz);
      formData.set("reminderOffsetMinutes", payload.reminderOffsetMinutes);
      return updateCardScheduleInline(formData);
    },
    onSuccess: (result, payload) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể cập nhật lịch.");
        return;
      }

      const nextDueAt = payload.dueAtIso.trim().length > 0 ? payload.dueAtIso : null;
      const nextStartAt = payload.startAtIso.trim().length > 0 ? payload.startAtIso : null;
      const nextRecurrence = payload.recurrenceRRule.trim().length > 0
        ? payload.recurrenceRRule.trim().toUpperCase()
        : null;
      const reminderValue = payload.reminderOffsetMinutes.trim().length > 0
        ? Number.parseInt(payload.reminderOffsetMinutes, 10)
        : null;
      onOptimisticCardPatch?.({
        due_at: nextDueAt,
        has_due_time: nextDueAt ? payload.hasDueTime : false,
        has_start_time: nextStartAt ? payload.hasStartTime : false,
        recurrence_anchor_at: nextRecurrence ? (nextDueAt ?? nextStartAt) : null,
        recurrence_rrule: nextRecurrence,
        recurrence_tz: nextRecurrence ? payload.recurrenceTz : null,
        reminder_offset_minutes: nextDueAt ? reminderValue : null,
        start_at: nextStartAt,
      });

      if (richnessQueryKey) {
        void queryClient.invalidateQueries({ queryKey: richnessQueryKey });
      }

      if (payload.closeOnSuccess) {
        setIsStartCalendarOpen(false);
        setIsDueCalendarOpen(false);
        setDatePopoverOpen(false);
      }
    },
  });

  return (
    <Popover onOpenChange={setDatePopoverOpen} open={isDatePopoverOpen}>
      {shouldUseQuickAddAnchor ? (
        <PopoverAnchor virtualRef={quickAddVirtualAnchorRef} />
      ) : null}
      <PopoverTrigger asChild>
        <button
          className={cn(buttonClassName, hasDueDate ? dueDateSurfaceClass : null)}
          type="button"
        >
          <CalendarClock className="h-4 w-4" />
          {hasDueDate && dueAtIso.length > 0 ? formatDueDateLabel(dueAtIso) : "Ngày"}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        avoidCollisions={!shouldUseQuickAddAnchor}
        className={cn(
          "w-[min(92vw,380px)] overflow-hidden border-slate-600 bg-[#2f333a] p-0 text-slate-100",
          popoverMaxHeightClass,
        )}
        collisionPadding={shouldUseQuickAddAnchor ? 16 : 12}
        data-lane-pan-stop
        side={shouldUseQuickAddAnchor ? "bottom" : undefined}
        sideOffset={8}
        sticky="always"
      >
        <div className={cn("flex flex-col", popoverMaxHeightClass)}>
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="card-date-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
              ref={contentBodyRef}
              onWheel={handleScrollBodyWheel}
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold">Ngày</p>
                <p className="text-xs text-slate-300">Thiết lập ngày bắt đầu, hạn chót, nhắc nhở và lặp lại.</p>
              </div>

              <div className="grid gap-2 rounded-md border border-slate-600 bg-[#24272e] p-2">
                <label className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-200">Ngày bắt đầu</span>
                  <input
                    checked={hasStartDate}
                    disabled={!canWrite}
                    onChange={(event) => {
                      const nextValue = event.target.checked;
                      setHasStartDate(nextValue);
                      if (!nextValue) {
                        setStartDate(undefined);
                      } else if (!startDate) {
                        setStartDate(new Date());
                      }
                    }}
                    type="checkbox"
                  />
                </label>
                {hasStartDate ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr_94px]">
                    <Popover onOpenChange={setIsStartCalendarOpen} open={isStartCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "h-9 rounded-md border border-slate-600 bg-[#11161d] px-2 text-left text-xs text-slate-100",
                            !canWrite ? "cursor-not-allowed opacity-60" : null,
                          )}
                          disabled={!canWrite}
                          type="button"
                        >
                          {startDate ? toLocalDateValue(startDate) : "Chọn ngày bắt đầu"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-auto border-slate-600 bg-[#2f333a] p-2"
                        sideOffset={6}
                      >
                        <Calendar
                          classNames={{ day_selected: startSelectedDayClass }}
                          mode="single"
                          onSelect={(nextDate) => {
                            if (!nextDate) {
                              return;
                            }
                            setHasStartDate(true);
                            setStartDate(nextDate);
                            setIsStartCalendarOpen(false);
                          }}
                          selected={startDate}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      className="h-9 min-h-0 border-slate-600 bg-[#11161d] px-2 text-xs text-slate-100"
                      disabled={!canWrite || !hasStartTime}
                      onChange={(event) => {
                        setStartTime(event.target.value);
                      }}
                      type="time"
                      value={startTime}
                    />
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-[11px] text-slate-300">
                  <input
                    checked={hasStartTime}
                    disabled={!canWrite || !hasStartDate}
                    onChange={(event) => {
                      setHasStartTime(event.target.checked);
                    }}
                    type="checkbox"
                  />
                  Bao gồm thời gian bắt đầu
                </label>
              </div>

              <div
                className={cn(
                  "grid gap-2 rounded-md border border-slate-600 bg-[#24272e] p-2",
                  hasDueDate ? dueDateSurfaceClass : null,
                )}
              >
                <label className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-200">Ngày hết hạn</span>
                  <input
                    checked={hasDueDate}
                    disabled={!canWrite}
                    onChange={(event) => {
                      const nextValue = event.target.checked;
                      setHasDueDate(nextValue);
                      if (!nextValue) {
                        setDueDate(undefined);
                        setReminderOffsetMinutes("");
                      } else if (!dueDate) {
                        setDueDate(new Date());
                      }
                    }}
                    type="checkbox"
                  />
                </label>
                {hasDueDate ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr_94px]">
                    <Popover onOpenChange={setIsDueCalendarOpen} open={isDueCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "h-9 rounded-md border border-slate-600 bg-[#11161d] px-2 text-left text-xs text-slate-100",
                            !canWrite ? "cursor-not-allowed opacity-60" : null,
                          )}
                          disabled={!canWrite}
                          type="button"
                        >
                          {dueDate ? toLocalDateValue(dueDate) : "Chọn hạn chót"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-auto border-slate-600 bg-[#2f333a] p-2"
                        sideOffset={6}
                      >
                        <Calendar
                          classNames={{ day_selected: dueSelectedDayClass }}
                          mode="single"
                          onSelect={(nextDate) => {
                            if (!nextDate) {
                              return;
                            }
                            setHasDueDate(true);
                            setDueDate(nextDate);
                            setIsDueCalendarOpen(false);
                          }}
                          selected={dueDate}
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="relative">
                      <Clock3 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="h-9 min-h-0 border-slate-600 bg-[#11161d] pl-7 pr-1 text-xs text-slate-100"
                        disabled={!canWrite || !hasDueTime}
                        onChange={(event) => {
                          setDueTime(event.target.value);
                        }}
                        type="time"
                        value={dueTime}
                      />
                    </div>
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-[11px] text-slate-300">
                  <input
                    checked={hasDueTime}
                    disabled={!canWrite || !hasDueDate}
                    onChange={(event) => {
                      setHasDueTime(event.target.checked);
                    }}
                    type="checkbox"
                  />
                  Bao gồm thời gian hết hạn
                </label>
                {hasDueDate ? (
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-200">
                      Trạng thái hạn: <span className="font-semibold">{dueDateStatusLabel}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      {DUE_DATE_LEGEND_ITEMS.map((item) => (
                        <span
                          className={cn("rounded border px-1.5 py-0.5 text-[10px]", getDueDateStatusSurfaceClass(item.status))}
                          key={item.status}
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border border-slate-600 bg-[#24272e] p-2">
                <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-200">
                  <TimerReset className="h-3.5 w-3.5" />
                  Nhắc nhở
                </p>
                <select
                  className="h-9 w-full rounded-md border border-slate-600 bg-[#11161d] px-2 text-xs text-slate-100"
                  disabled={!canWrite}
                  name="reminderOffsetMinutes"
                  onChange={(event) => {
                    const nextReminderValue = event.target.value;
                    setReminderOffsetMinutes(nextReminderValue);
                    if (nextReminderValue.length < 1 || hasDueDate) {
                      return;
                    }

                    setHasDueDate(true);
                    if (!dueDate) {
                      setDueDate(new Date());
                    }
                  }}
                  value={reminderOffsetMinutes}
                >
                  {REMINDER_PRESETS.map((preset) => (
                    <option key={preset.value || "none"} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-md border border-slate-600 bg-[#24272e] p-2">
                <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-200">
                  <Repeat className="h-3.5 w-3.5" />
                  Định kỳ
                </p>
                <select
                  className="h-9 w-full rounded-md border border-slate-600 bg-[#11161d] px-2 text-xs text-slate-100"
                  disabled={!canWrite}
                  onChange={(event) => {
                    const nextPreset = event.target.value;
                    setRecurrencePreset(nextPreset);
                  }}
                  value={recurrencePreset}
                >
                  {RECURRENCE_PRESETS.map((preset) => (
                    <option key={preset.value || "none"} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>

                {recurrencePreset === "CUSTOM" ? (
                  <Input
                    className="mt-2 h-9 min-h-0 border-slate-600 bg-[#11161d] text-xs text-slate-100"
                    disabled={!canWrite}
                    onChange={(event) => {
                      setCustomRecurrenceRule(event.target.value);
                    }}
                    placeholder="Ví dụ: FREQ=WEEKLY;BYDAY=MO,WE,FR"
                    value={customRecurrenceRule}
                  />
                ) : null}
                <p className="mt-1 text-[11px] text-slate-400">Timezone hiện tại: {timezone}</p>
              </div>

            </div>

            <div className="border-t border-slate-600/80 bg-[#2f333a]/95 p-3 backdrop-blur">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="min-h-9 bg-[#0c66e4] text-white hover:bg-[#0055cc]"
                  disabled={!canWrite || scheduleMutation.isPending}
                  onClick={() => {
                    if (!canWrite) {
                      return;
                    }

                    scheduleMutation.mutate({
                      closeOnSuccess: true,
                      dueAtIso,
                      hasDueTime,
                      hasStartTime,
                      recurrenceRRule,
                      recurrenceTz: timezone,
                      reminderOffsetMinutes,
                      startAtIso,
                    });
                  }}
                  type="button"
                >
                  {scheduleMutation.isPending ? "Đang lưu..." : "Lưu"}
                </Button>
                <Button
                  className="min-h-9 border-slate-600 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                  disabled={!canWrite || scheduleMutation.isPending}
                  onClick={() => {
                    setHasStartDate(false);
                    setStartDate(undefined);
                    setHasDueDate(false);
                    setDueDate(undefined);
                    setReminderOffsetMinutes("");
                    setRecurrencePreset("");
                    setCustomRecurrenceRule("");
                  }}
                  type="button"
                  variant="secondary"
                >
                  Xóa lịch
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-600 p-3 pt-2">
            <Button
              className="min-h-8 w-full border border-slate-600 bg-slate-900/40 text-xs text-slate-200 hover:bg-slate-800"
              disabled={!canWrite || scheduleMutation.isPending}
              onClick={() => {
                if (!canWrite) {
                  return;
                }

                scheduleMutation.mutate({
                  closeOnSuccess: false,
                  dueAtIso: "",
                  hasDueTime: false,
                  hasStartTime: false,
                  recurrenceRRule: "",
                  recurrenceTz: "",
                  reminderOffsetMinutes: "",
                  startAtIso: "",
                });
              }}
              type="button"
              variant="secondary"
            >
              {scheduleMutation.isPending ? "Đang xóa..." : "Xóa tất cả ngày và nhắc nhở"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
