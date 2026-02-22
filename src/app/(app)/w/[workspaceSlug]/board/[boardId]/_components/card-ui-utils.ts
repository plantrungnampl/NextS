import type { AttachmentRecord, CardRecord } from "../types";

export type ChecklistItem = {
  checked: boolean;
  text: string;
};

export type DueDateStatus = "completed" | "future" | "none" | "overdue" | "today" | "upcoming";

const DEFAULT_UPCOMING_WINDOW_HOURS = 24;

const DUE_DATE_STATUS_LABEL: Record<DueDateStatus, string> = {
  completed: "Completed",
  future: "Later",
  none: "No due date",
  overdue: "Overdue",
  today: "Today",
  upcoming: "Due soon",
};

const DUE_DATE_STATUS_BADGE_CLASS: Record<DueDateStatus, string> = {
  completed: "!border-slate-500/80 !bg-slate-500/20 !text-slate-100",
  future: "!border-emerald-500/70 !bg-emerald-500/15 !text-emerald-200",
  none: "!border-slate-600 !bg-slate-800/80 !text-slate-200",
  overdue: "!border-rose-500/70 !bg-rose-500/15 !text-rose-200",
  today: "!border-amber-500/70 !bg-amber-500/15 !text-amber-200",
  upcoming: "!border-sky-500/70 !bg-sky-500/15 !text-sky-200",
};

const DUE_DATE_STATUS_SURFACE_CLASS: Record<DueDateStatus, string> = {
  completed: "border-slate-500/80 bg-slate-500/12 text-slate-100",
  future: "border-emerald-500/70 bg-emerald-500/12 text-emerald-200",
  none: "border-slate-600 bg-slate-900/30 text-slate-200",
  overdue: "border-rose-500/70 bg-rose-500/14 text-rose-200",
  today: "border-amber-500/70 bg-amber-500/14 text-amber-200",
  upcoming: "border-sky-500/70 bg-sky-500/14 text-sky-200",
};

const DUE_DATE_STATUS_SELECTED_DAY_CLASS: Record<DueDateStatus, string> = {
  completed: "bg-slate-600 text-slate-100 hover:bg-slate-600",
  future: "bg-emerald-600 text-white hover:bg-emerald-600",
  none: "bg-sky-600 text-white hover:bg-sky-600",
  overdue: "bg-rose-600 text-white hover:bg-rose-600",
  today: "bg-amber-500 text-slate-950 hover:bg-amber-500",
  upcoming: "bg-sky-600 text-white hover:bg-sky-600",
};

const MARKDOWN_CHECKLIST_PATTERN = /(?:^|\n)\s*[-*]\s+\[([ xX])]\s+(.+)/g;

function decodeCommonEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function descriptionToPlainText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return decodeCommonEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMarkdownChecklist(description: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  for (const match of description.matchAll(MARKDOWN_CHECKLIST_PATTERN)) {
    const checkedFlag = match[1];
    const rawText = (match[2] ?? "").trim();
    if (!rawText) {
      continue;
    }

    items.push({ checked: checkedFlag.toLowerCase() === "x", text: rawText });
  }

  return items;
}

function parseHtmlTaskList(description: string): ChecklistItem[] {
  const taskMatches = Array.from(
    description.matchAll(/<li[^>]*data-checked=\"(true|false)\"[^>]*>([\s\S]*?)<\/li>/gi),
  );

  return taskMatches
    .map((match) => ({
      checked: (match[1] ?? "false").toLowerCase() === "true",
      text: descriptionToPlainText(match[2] ?? ""),
    }))
    .filter((entry) => entry.text.length > 0);
}

export function parseChecklistItems(description: string | null | undefined): ChecklistItem[] {
  if (!description) {
    return [];
  }

  const markdownItems = parseMarkdownChecklist(description);
  if (markdownItems.length > 0) {
    return markdownItems;
  }

  return parseHtmlTaskList(description);
}

export function getChecklistProgress(card: CardRecord): { completed: number; total: number } {
  const parsedItems = parseChecklistItems(card.description);
  let completed = parsedItems.filter((item) => item.checked).length;
  let total = parsedItems.length;

  if (
    typeof card.checklistCompletedCount === "number" &&
    typeof card.checklistTotalCount === "number" &&
    card.checklistTotalCount > 0
  ) {
    completed = Math.max(0, Math.min(card.checklistCompletedCount, card.checklistTotalCount));
    total = card.checklistTotalCount;
  }

  return { completed, total };
}

export function isDueDateOverdue(dueAt: string | null | undefined): boolean {
  return getDueDateStatus(dueAt) === "overdue";
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function getDueDateStatus(dueAt: string | null | undefined): DueDateStatus {
  return getDueDateStatusWithContext(dueAt, {});
}

export function getDueDateStatusWithContext(
  dueAt: string | null | undefined,
  options: {
    isCompleted?: boolean;
    now?: Date;
    upcomingWindowHours?: number;
  },
): DueDateStatus {
  if (!dueAt) {
    return "none";
  }

  const parsedDate = new Date(dueAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return "none";
  }

  if (options.isCompleted) {
    return "completed";
  }

  const now = options.now ?? new Date();
  if (parsedDate.getTime() < now.getTime()) {
    return "overdue";
  }

  if (isSameLocalDay(parsedDate, now)) {
    return "today";
  }

  const upcomingWindowHours = Math.max(
    1,
    Math.floor(options.upcomingWindowHours ?? DEFAULT_UPCOMING_WINDOW_HOURS),
  );
  const upcomingWindowMs = upcomingWindowHours * 60 * 60 * 1000;
  if (parsedDate.getTime() - now.getTime() <= upcomingWindowMs) {
    return "upcoming";
  }

  return "future";
}

export function getDueDateStatusLabel(status: DueDateStatus): string {
  return DUE_DATE_STATUS_LABEL[status];
}

export function getDueDateStatusBadgeClass(status: DueDateStatus): string {
  return DUE_DATE_STATUS_BADGE_CLASS[status];
}

export function getDueDateStatusSurfaceClass(status: DueDateStatus): string {
  return DUE_DATE_STATUS_SURFACE_CLASS[status];
}

export function getDueDateStatusSelectedDayClass(status: DueDateStatus): string {
  return DUE_DATE_STATUS_SELECTED_DAY_CLASS[status];
}

export function formatDueDateLabel(dueAt: string | null | undefined): string {
  if (!dueAt) {
    return "No due date";
  }

  const parsedDate = new Date(dueAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return dueAt;
  }

  return parsedDate.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const timezoneOffsetMs = parsedDate.getTimezoneOffset() * 60_000;
  const localDate = new Date(parsedDate.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 16);
}

export function getInitials(displayName: string): string {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter((value) => value.length > 0);

  if (words.length === 0) {
    return "?";
  }

  const initials = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("");
  return initials || "?";
}

export function resolveCardCoverAttachment(
  card: CardRecord,
  attachments: AttachmentRecord[],
): AttachmentRecord | null {
  if (!attachments.length) {
    return null;
  }

  const preferredCover =
    card.coverAttachmentId
      ? attachments.find((attachment) => attachment.id === card.coverAttachmentId)
      : null;
  if (preferredCover && preferredCover.contentType?.startsWith("image/")) {
    return preferredCover;
  }

  return attachments.find((attachment) => attachment.contentType?.startsWith("image/")) ?? null;
}
