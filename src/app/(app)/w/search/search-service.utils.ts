import type { SearchDueBucket } from "./search-filters";
import type { SearchResultItem } from "./search-types";

export function toQueryLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.max(1, Math.min(50, Math.floor(limit)));
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .slice(0, 220);
}

export function buildFuzzyLikeValue(query: string): string {
  const tokenized = query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .join("%");
  return `%${tokenized}%`;
}

export function trimSnippet(value: string | null, maxLength = 180): string | null {
  if (!value) {
    return null;
  }

  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length < 1) {
    return null;
  }

  return collapsed.length > maxLength
    ? `${collapsed.slice(0, Math.max(10, maxLength - 1)).trimEnd()}…`
    : collapsed;
}

export function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseOptionalDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function resolveDueBucketMatches(cardDueAt: string | null, now: Date): Record<SearchDueBucket, boolean> {
  const dueDate = parseOptionalDate(cardDueAt);
  if (!dueDate) {
    return {
      "due-next-30-days": false,
      "due-next-7-days": false,
      "due-tomorrow": false,
      "no-due-date": true,
      overdue: false,
    };
  }

  const tomorrowStart = addDays(startOfDay(now), 1);
  const tomorrowEnd = addDays(startOfDay(now), 2);
  const sevenDaysAhead = addDays(startOfDay(now), 7);
  const thirtyDaysAhead = addDays(startOfDay(now), 30);

  return {
    "due-next-30-days":
      dueDate.getTime() > sevenDaysAhead.getTime() && dueDate.getTime() <= thirtyDaysAhead.getTime(),
    "due-next-7-days":
      dueDate.getTime() > tomorrowEnd.getTime() && dueDate.getTime() <= sevenDaysAhead.getTime(),
    "due-tomorrow":
      dueDate.getTime() >= tomorrowStart.getTime() && dueDate.getTime() < tomorrowEnd.getTime(),
    "no-due-date": false,
    overdue: dueDate.getTime() < now.getTime(),
  };
}

function trigramSimilarity(left: string, right: string): number {
  if (left.length < 1 || right.length < 1) {
    return 0;
  }

  const toTrigrams = (value: string): Set<string> => {
    const normalized = `  ${value} `;
    const output = new Set<string>();
    for (let index = 0; index <= normalized.length - 3; index += 1) {
      output.add(normalized.slice(index, index + 3));
    }
    return output;
  };

  const leftSet = toTrigrams(left);
  const rightSet = toTrigrams(right);

  let intersectionCount = 0;
  for (const trigram of leftSet) {
    if (rightSet.has(trigram)) {
      intersectionCount += 1;
    }
  }

  const denominator = leftSet.size + rightSet.size;
  if (denominator < 1) {
    return 0;
  }

  return (2 * intersectionCount) / denominator;
}

export function computeSearchScore(args: {
  matchedFts: boolean;
  queryNormalized: string;
  searchableText: string;
}): number {
  const fuzzyScore = trigramSimilarity(args.searchableText, args.queryNormalized);
  const ftsScore = args.matchedFts ? 1 : 0;
  const rawScore = 0.75 * ftsScore + 0.25 * fuzzyScore;
  return Number(rawScore.toFixed(6));
}

export function isMissingColumnError(error: { code?: string; message?: string } | null, columnName: string): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "42703") {
    return true;
  }

  const message = error.message ?? "";
  return message.toLowerCase().includes(columnName.toLowerCase());
}

export function decodeCursorOffset(cursor: string | null): number {
  if (!cursor) {
    return 0;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      offset?: unknown;
    };
    const parsed = Number(decoded.offset);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return Math.floor(parsed);
  } catch {
    return 0;
  }
}

export function encodeCursorOffset(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

export function toSearchItemIdentity(entityType: SearchResultItem["entityType"], entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function sortSearchItems(items: SearchResultItem[]) {
  items.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    const leftUpdatedAt = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    const rightUpdatedAt = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    if (leftUpdatedAt !== rightUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }

    if (left.entityType !== right.entityType) {
      return left.entityType.localeCompare(right.entityType);
    }

    return left.id.localeCompare(right.id);
  });
}
