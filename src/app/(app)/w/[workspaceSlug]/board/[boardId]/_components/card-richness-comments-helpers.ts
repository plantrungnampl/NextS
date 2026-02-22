import type { WorkspaceMemberRecord } from "../types";

export type MentionContext = {
  end: number;
  query: string;
  start: number;
};

export type CommentMutationResult =
  | { error: string; ok: false }
  | { ok: true };

function formatAbsoluteTimestamp(date: Date): string {
  const datePart = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${datePart} at ${timePart}`;
}

function formatRelativeTimestamp(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) {
    return "just now";
  }

  const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const units = [
    { max: 3_600_000, size: 60_000, unit: "minute" as const },
    { max: 86_400_000, size: 3_600_000, unit: "hour" as const },
    { max: 604_800_000, size: 86_400_000, unit: "day" as const },
    { max: 2_592_000_000, size: 604_800_000, unit: "week" as const },
  ];

  for (const entry of units) {
    if (diffMs < entry.max) {
      const value = Math.floor(diffMs / entry.size);
      return relative.format(-value, entry.unit);
    }
  }

  const months = Math.floor(diffMs / 2_592_000_000);
  if (months < 12) {
    return relative.format(-months, "month");
  }

  const years = Math.floor(months / 12);
  return relative.format(-years, "year");
}

export function formatCommentTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${formatRelativeTimestamp(date)} · ${formatAbsoluteTimestamp(date)}`;
}

export function resolveMentionContext(value: string, cursor: number | null): MentionContext | null {
  if (cursor === null) {
    return null;
  }

  const left = value.slice(0, cursor);
  const match = left.match(/(?:^|\s)@([a-zA-Z0-9._-]{0,48})$/);
  if (!match) {
    return null;
  }

  const query = match[1] ?? "";
  return {
    end: cursor,
    query,
    start: cursor - query.length - 1,
  };
}

export function toFormData(entries: Array<[string, string]>): FormData {
  const formData = new FormData();
  for (const [key, value] of entries) {
    formData.set(key, value);
  }

  return formData;
}

export function filterMentionCandidates(
  mentionContext: MentionContext | null,
  workspaceMembers: WorkspaceMemberRecord[],
): WorkspaceMemberRecord[] {
  if (!mentionContext) {
    return [];
  }

  const normalizedQuery = mentionContext.query.trim().toLowerCase();
  return workspaceMembers
    .filter((member) =>
      normalizedQuery.length === 0
        ? true
        : member.displayName.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 6);
}
