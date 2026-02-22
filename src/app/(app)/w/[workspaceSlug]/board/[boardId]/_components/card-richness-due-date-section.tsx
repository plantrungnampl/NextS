"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Button,
  Calendar,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { cn } from "@/shared";

import { updateCardDueDateInline } from "../actions.card-modal";
import type { CardRecord } from "../types";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";
import {
  formatDueDateLabel,
  getDueDateStatusBadgeClass,
  getDueDateStatusLabel,
  getDueDateStatusWithContext,
  toDateTimeLocalValue,
} from "./card-ui-utils";

type CardDueDateSectionProps = {
  boardId: string;
  canWrite: boolean;
  card: CardRecord;
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
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
};

function parseDueDateDraft(dueAt: string | null): { date: Date | undefined; time: string } {
  const localValue = toDateTimeLocalValue(dueAt);
  if (!localValue) {
    return { date: undefined, time: "09:00" };
  }

  const [datePart, timePart] = localValue.split("T");
  const [year, month, day] = datePart.split("-").map((value) => Number.parseInt(value, 10));
  if (!year || !month || !day) {
    return { date: undefined, time: "09:00" };
  }

  return {
    date: new Date(year, month - 1, day),
    time: (timePart ?? "09:00").slice(0, 5),
  };
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function toLocalDatePart(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sanitizeTimeInput(value: string): string {
  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  return "09:00";
}

function buildDueAtDraft(date: Date | undefined, time: string): string {
  if (!date) {
    return "";
  }

  return `${toLocalDatePart(date)}T${sanitizeTimeInput(time)}`;
}

function toDueAtIso(dueAtDraft: string): string | null {
  const trimmed = dueAtDraft.trim();
  if (trimmed.length < 1) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function invalidateRichnessQuery(params: {
  queryClient: ReturnType<typeof useQueryClient>;
  richnessQueryKey?: readonly [string, string, string, string];
}) {
  if (!params.richnessQueryKey) {
    return;
  }

  void params.queryClient.invalidateQueries({ queryKey: params.richnessQueryKey });
}

// eslint-disable-next-line max-lines-per-function
export function CardDueDateSection({
  boardId,
  canWrite,
  card,
  onOptimisticCardPatch,
  richnessQueryKey,
  workspaceSlug,
}: CardDueDateSectionProps) {
  const queryClient = useQueryClient();
  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId: card.id,
    workspaceSlug,
  });
  const initialDraft = useMemo(() => parseDueDateDraft(card.due_at), [card.due_at]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDraft.date);
  const [timeValue, setTimeValue] = useState(initialDraft.time);
  const dueAtDraft = buildDueAtDraft(selectedDate, timeValue);
  const dueDateStatus = getDueDateStatusWithContext(card.due_at, {
    isCompleted: card.is_completed,
  });
  const dueMutation = useMutation({
    mutationKey: [...modalMutationKey, "due-date"],
    mutationFn: async (dueAt: string) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", card.id);
      formData.set("dueAt", dueAt);
      return updateCardDueDateInline(formData);
    },
    onSuccess: (result, dueAt) => {
      if (!result.ok) {
        toast.error(result.error ?? "Không thể cập nhật hạn chót.");
        return;
      }

      const dueAtIso = toDueAtIso(dueAt);
      onOptimisticCardPatch?.({
        due_at: dueAtIso,
        has_due_time: dueAtIso !== null,
        has_start_time: false,
        recurrence_anchor_at: null,
        recurrence_rrule: null,
        recurrence_tz: null,
        reminder_offset_minutes: null,
        start_at: null,
      });
      invalidateRichnessQuery({ queryClient, richnessQueryKey });
    },
  });

  return (
    <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/35 p-3">
      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
        <CalendarClock className="h-3.5 w-3.5" />
        Due date
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-300">{formatDueDateLabel(card.due_at)}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", getDueDateStatusBadgeClass(dueDateStatus))}>
          {getDueDateStatusLabel(dueDateStatus)}
        </span>
      </div>

      {canWrite ? (
        <>
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    className="h-9 justify-start !border-slate-600 !bg-[#11161d] px-3 text-xs !text-slate-100 hover:!bg-slate-800"
                    type="button"
                    variant="secondary"
                  >
                    <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                    {selectedDate ? toLocalDatePart(selectedDate) : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <Calendar
                    mode="single"
                    onSelect={setSelectedDate}
                    selected={selectedDate}
                  />
                </PopoverContent>
              </Popover>
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-9 border-slate-600 bg-[#11161d] pl-7 text-xs text-slate-100"
                  onChange={(event) => {
                    setTimeValue(event.target.value);
                  }}
                  type="time"
                  value={timeValue}
                />
              </div>
            </div>

            <Button
              className="min-h-8 w-full bg-[#0c66e4] text-white hover:bg-[#0055cc]"
              disabled={dueMutation.isPending}
              onClick={() => {
                if (!canWrite) {
                  return;
                }
                dueMutation.mutate(dueAtDraft);
              }}
              type="button"
            >
              {dueMutation.isPending ? "Saving due date..." : "Save due date"}
            </Button>
          </div>

          <Button
            className="min-h-8 w-full !border-slate-600 !bg-slate-900/60 !text-slate-200 hover:!bg-slate-800"
            disabled={dueMutation.isPending}
            onClick={() => {
              if (!canWrite) {
                return;
              }
              dueMutation.mutate("");
            }}
            type="button"
            variant="secondary"
          >
            {dueMutation.isPending ? "Clearing..." : "Clear due date"}
          </Button>
        </>
      ) : (
        <p className="text-[11px] text-slate-400">Read-only mode: due date is locked.</p>
      )}
    </div>
  );
}
