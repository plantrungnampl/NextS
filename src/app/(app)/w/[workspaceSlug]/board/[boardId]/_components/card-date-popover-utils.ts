import type { WheelEvent } from "react";

import type { DueDateStatus } from "./card-ui-utils";

export const REMINDER_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Không nhắc", value: "" },
  { label: "Đúng hạn", value: "0" },
  { label: "10 phút trước", value: "-10" },
  { label: "1 giờ trước", value: "-60" },
  { label: "1 ngày trước", value: "-1440" },
  { label: "2 ngày trước", value: "-2880" },
  { label: "1 tuần trước", value: "-10080" },
];

export const RECURRENCE_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Không lặp", value: "" },
  { label: "Mỗi ngày", value: "FREQ=DAILY" },
  { label: "Mỗi tuần", value: "FREQ=WEEKLY" },
  { label: "Mỗi tháng", value: "FREQ=MONTHLY" },
  { label: "Mỗi năm", value: "FREQ=YEARLY" },
  { label: "Tùy chỉnh", value: "CUSTOM" },
];

export const DUE_DATE_LEGEND_ITEMS: Array<{ label: string; status: DueDateStatus }> = [
  { label: "Quá hạn", status: "overdue" },
  { label: "Hôm nay", status: "today" },
  { label: "Sắp tới hạn", status: "upcoming" },
  { label: "Xa hạn", status: "future" },
  { label: "Hoàn thành", status: "completed" },
];

type DateDraft = {
  date: Date | undefined;
  hasDate: boolean;
  hasTime: boolean;
  time: string;
};

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function toLocalDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseIsoToDraft(value: string | null, hasTime: boolean): DateDraft {
  if (!value) {
    return {
      date: undefined,
      hasDate: false,
      hasTime,
      time: "09:00",
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      date: undefined,
      hasDate: false,
      hasTime,
      time: "09:00",
    };
  }

  return {
    date: new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
    hasDate: true,
    hasTime,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

export function buildIsoFromDraft(params: {
  date: Date | undefined;
  hasDate: boolean;
  hasTime: boolean;
  time: string;
}): string {
  if (!params.hasDate || !params.date) {
    return "";
  }

  const [hourPart, minutePart] = params.time.split(":");
  const parsedHour = Number.parseInt(hourPart ?? "", 10);
  const parsedMinute = Number.parseInt(minutePart ?? "", 10);
  const hour = params.hasTime && Number.isFinite(parsedHour) ? parsedHour : 9;
  const minute = params.hasTime && Number.isFinite(parsedMinute) ? parsedMinute : 0;
  const utcValue = new Date(
    params.date.getFullYear(),
    params.date.getMonth(),
    params.date.getDate(),
    hour,
    minute,
    0,
    0,
  );
  return utcValue.toISOString();
}

export function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function forceScrollableWheel(event: WheelEvent<HTMLDivElement>) {
  const target = event.currentTarget;
  if (target.scrollHeight <= target.clientHeight) {
    return;
  }

  target.scrollTop += event.deltaY;
  event.preventDefault();
  event.stopPropagation();
}
