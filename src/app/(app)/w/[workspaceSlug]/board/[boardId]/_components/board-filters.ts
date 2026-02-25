import type { CardRecord, LabelRecord, ListWithCards } from "../types";
import { descriptionToPlainText } from "./card-ui-utils";

export type BoardFilterMatchMode = "any" | "all";
export type BoardFilterCardStatus = "completed" | "not-completed";
export type BoardFilterDueBucket =
  | "no-due-date"
  | "overdue"
  | "due-tomorrow"
  | "due-next-7-days"
  | "due-next-30-days";
export type BoardFilterActivityBucket =
  | "active-1-week"
  | "active-2-weeks"
  | "active-3-weeks"
  | "inactive-4-weeks";

export const BOARD_FILTER_MEMBER_NO_MEMBER = "none";
export const BOARD_FILTER_MEMBER_ASSIGNED_TO_ME = "me";
export const BOARD_FILTER_LABEL_NO_LABEL = "none";

const FILTER_QUERY_PARAM = "bf_q";
const FILTER_MEMBERS_PARAM = "bf_members";
const FILTER_STATUS_PARAM = "bf_status";
const FILTER_DUE_PARAM = "bf_due";
const FILTER_LABELS_PARAM = "bf_labels";
const FILTER_ACTIVITY_PARAM = "bf_activity";
const FILTER_MATCH_PARAM = "bf_match";
const FILTER_COLLAPSE_PARAM = "bf_collapse";

const BOARD_FILTER_CARD_STATUS_VALUES = new Set<BoardFilterCardStatus>([
  "completed",
  "not-completed",
]);
const BOARD_FILTER_DUE_VALUES = new Set<BoardFilterDueBucket>([
  "no-due-date",
  "overdue",
  "due-tomorrow",
  "due-next-7-days",
  "due-next-30-days",
]);
const BOARD_FILTER_ACTIVITY_VALUES = new Set<BoardFilterActivityBucket>([
  "active-1-week",
  "active-2-weeks",
  "active-3-weeks",
  "inactive-4-weeks",
]);

export type BoardFilterState = {
  activityBuckets: BoardFilterActivityBucket[];
  collapseEmptyLists: boolean;
  dueBuckets: BoardFilterDueBucket[];
  labelIds: string[];
  matchMode: BoardFilterMatchMode;
  members: string[];
  query: string;
  statuses: BoardFilterCardStatus[];
};

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const nextValues: string[] = [];
  for (const value of values) {
    if (value.length < 1 || seen.has(value)) {
      continue;
    }

    seen.add(value);
    nextValues.push(value);
  }
  return nextValues;
}

function parseCsvParam(params: URLSearchParams, key: string): string[] {
  const rawValue = params.get(key) ?? "";
  if (rawValue.length < 1) {
    return [];
  }

  return uniqueValues(
    rawValue
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function readMatchMode(rawValue: string | null): BoardFilterMatchMode {
  return rawValue === "all" ? "all" : "any";
}

function writeCsvParam(params: URLSearchParams, key: string, values: string[]) {
  if (values.length < 1) {
    params.delete(key);
    return;
  }

  params.set(key, values.join(","));
}

function parseOptionalDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function clampKeyword(value: string): string {
  return value.trim().slice(0, 120);
}

export function createDefaultBoardFilterState(): BoardFilterState {
  return {
    activityBuckets: [],
    collapseEmptyLists: false,
    dueBuckets: [],
    labelIds: [],
    matchMode: "any",
    members: [],
    query: "",
    statuses: [],
  };
}

export function parseBoardFilterStateFromSearchParams(params: URLSearchParams): BoardFilterState {
  const memberValues = parseCsvParam(params, FILTER_MEMBERS_PARAM);
  const statusValues = parseCsvParam(params, FILTER_STATUS_PARAM).filter((value): value is BoardFilterCardStatus =>
    BOARD_FILTER_CARD_STATUS_VALUES.has(value as BoardFilterCardStatus),
  );
  const dueValues = parseCsvParam(params, FILTER_DUE_PARAM).filter((value): value is BoardFilterDueBucket =>
    BOARD_FILTER_DUE_VALUES.has(value as BoardFilterDueBucket),
  );
  const labelValues = parseCsvParam(params, FILTER_LABELS_PARAM);
  const activityValues = parseCsvParam(params, FILTER_ACTIVITY_PARAM).filter((value): value is BoardFilterActivityBucket =>
    BOARD_FILTER_ACTIVITY_VALUES.has(value as BoardFilterActivityBucket),
  );
  const collapseValue = params.get(FILTER_COLLAPSE_PARAM);

  return {
    activityBuckets: activityValues,
    collapseEmptyLists: collapseValue === "1",
    dueBuckets: dueValues,
    labelIds: labelValues,
    matchMode: readMatchMode(params.get(FILTER_MATCH_PARAM)),
    members: memberValues,
    query: clampKeyword(params.get(FILTER_QUERY_PARAM) ?? ""),
    statuses: statusValues,
  };
}

export function writeBoardFilterStateToSearchParams(params: URLSearchParams, state: BoardFilterState) {
  const sanitizedQuery = clampKeyword(state.query);
  const sanitizedMembers = uniqueValues(
    state.members.map((value) => value.trim()).filter((value) => value.length > 0),
  );
  const sanitizedStatuses = uniqueValues(
    state.statuses.filter((value) => BOARD_FILTER_CARD_STATUS_VALUES.has(value)),
  ) as BoardFilterCardStatus[];
  const sanitizedDueBuckets = uniqueValues(
    state.dueBuckets.filter((value) => BOARD_FILTER_DUE_VALUES.has(value)),
  ) as BoardFilterDueBucket[];
  const sanitizedLabelIds = uniqueValues(
    state.labelIds.map((value) => value.trim()).filter((value) => value.length > 0),
  );
  const sanitizedActivityBuckets = uniqueValues(
    state.activityBuckets.filter((value) => BOARD_FILTER_ACTIVITY_VALUES.has(value)),
  ) as BoardFilterActivityBucket[];

  if (sanitizedQuery.length < 1) {
    params.delete(FILTER_QUERY_PARAM);
  } else {
    params.set(FILTER_QUERY_PARAM, sanitizedQuery);
  }

  writeCsvParam(params, FILTER_MEMBERS_PARAM, sanitizedMembers);
  writeCsvParam(params, FILTER_STATUS_PARAM, sanitizedStatuses);
  writeCsvParam(params, FILTER_DUE_PARAM, sanitizedDueBuckets);
  writeCsvParam(params, FILTER_LABELS_PARAM, sanitizedLabelIds);
  writeCsvParam(params, FILTER_ACTIVITY_PARAM, sanitizedActivityBuckets);

  if (state.matchMode === "all") {
    params.set(FILTER_MATCH_PARAM, "all");
  } else {
    params.delete(FILTER_MATCH_PARAM);
  }

  if (state.collapseEmptyLists) {
    params.set(FILTER_COLLAPSE_PARAM, "1");
  } else {
    params.delete(FILTER_COLLAPSE_PARAM);
  }
}

function matchesKeyword(card: CardRecord, keyword: string): boolean {
  if (keyword.length < 1) {
    return true;
  }

  const normalizedKeyword = keyword.toLowerCase();
  const description = descriptionToPlainText(card.description).toLowerCase();
  if (card.title.toLowerCase().includes(normalizedKeyword)) {
    return true;
  }

  if (description.includes(normalizedKeyword)) {
    return true;
  }

  return card.labels.some((label) => label.name.toLowerCase().includes(normalizedKeyword));
}

function matchesMembers(card: CardRecord, selectedMembers: string[], viewerId: string): boolean {
  if (selectedMembers.length < 1) {
    return true;
  }

  const assignedIds = new Set(card.assignees.map((entry) => entry.id));
  return selectedMembers.some((memberValue) => {
    if (memberValue === BOARD_FILTER_MEMBER_NO_MEMBER) {
      return card.assignees.length < 1;
    }
    if (memberValue === BOARD_FILTER_MEMBER_ASSIGNED_TO_ME) {
      return assignedIds.has(viewerId);
    }
    return assignedIds.has(memberValue);
  });
}

function matchesStatus(card: CardRecord, selectedStatuses: BoardFilterCardStatus[]): boolean {
  if (selectedStatuses.length < 1) {
    return true;
  }

  return selectedStatuses.some((status) =>
    status === "completed" ? card.is_completed : !card.is_completed,
  );
}

function resolveDueBucketMatches(card: CardRecord, now: Date): Record<BoardFilterDueBucket, boolean> {
  const dueDate = parseOptionalDate(card.due_at);
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
    "due-next-30-days": dueDate.getTime() > sevenDaysAhead.getTime() && dueDate.getTime() <= thirtyDaysAhead.getTime(),
    "due-next-7-days": dueDate.getTime() > tomorrowEnd.getTime() && dueDate.getTime() <= sevenDaysAhead.getTime(),
    "due-tomorrow": dueDate.getTime() >= tomorrowStart.getTime() && dueDate.getTime() < tomorrowEnd.getTime(),
    "no-due-date": false,
    overdue: dueDate.getTime() < now.getTime(),
  };
}

function matchesDueDate(card: CardRecord, dueBuckets: BoardFilterDueBucket[], now: Date): boolean {
  if (dueBuckets.length < 1) {
    return true;
  }

  const bucketMatches = resolveDueBucketMatches(card, now);
  return dueBuckets.some((bucket) => bucketMatches[bucket]);
}

function matchesLabels(card: CardRecord, selectedLabelIds: string[]): boolean {
  if (selectedLabelIds.length < 1) {
    return true;
  }

  const cardLabelIds = new Set(card.labels.map((label) => label.id));
  return selectedLabelIds.some((value) => {
    if (value === BOARD_FILTER_LABEL_NO_LABEL) {
      return card.labels.length < 1;
    }
    return cardLabelIds.has(value);
  });
}

function resolveActivityBucketMatches(card: CardRecord, now: Date): Record<BoardFilterActivityBucket, boolean> {
  const updatedAt = parseOptionalDate(card.updated_at);
  if (!updatedAt) {
    return {
      "active-1-week": false,
      "active-2-weeks": false,
      "active-3-weeks": false,
      "inactive-4-weeks": true,
    };
  }

  const diffMs = now.getTime() - updatedAt.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  return {
    "active-1-week": diffMs <= weekMs,
    "active-2-weeks": diffMs > weekMs && diffMs <= weekMs * 2,
    "active-3-weeks": diffMs > weekMs * 2 && diffMs <= weekMs * 3,
    "inactive-4-weeks": diffMs >= weekMs * 4,
  };
}

function matchesActivity(card: CardRecord, activityBuckets: BoardFilterActivityBucket[], now: Date): boolean {
  if (activityBuckets.length < 1) {
    return true;
  }

  const bucketMatches = resolveActivityBucketMatches(card, now);
  return activityBuckets.some((bucket) => bucketMatches[bucket]);
}

type CardFilterContext = {
  now: Date;
  state: BoardFilterState;
  viewerId: string;
};

function matchesCard(card: CardRecord, context: CardFilterContext): boolean {
  const categoryResults: boolean[] = [];
  const keyword = clampKeyword(context.state.query);

  if (keyword.length > 0) {
    categoryResults.push(matchesKeyword(card, keyword));
  }

  if (context.state.members.length > 0) {
    categoryResults.push(matchesMembers(card, context.state.members, context.viewerId));
  }

  if (context.state.statuses.length > 0) {
    categoryResults.push(matchesStatus(card, context.state.statuses));
  }

  if (context.state.dueBuckets.length > 0) {
    categoryResults.push(matchesDueDate(card, context.state.dueBuckets, context.now));
  }

  if (context.state.labelIds.length > 0) {
    categoryResults.push(matchesLabels(card, context.state.labelIds));
  }

  if (context.state.activityBuckets.length > 0) {
    categoryResults.push(matchesActivity(card, context.state.activityBuckets, context.now));
  }

  if (categoryResults.length < 1) {
    return true;
  }

  if (context.state.matchMode === "all") {
    return categoryResults.every(Boolean);
  }

  return categoryResults.some(Boolean);
}

export function hasActiveBoardFilters(state: BoardFilterState): boolean {
  return (
    state.query.trim().length > 0 ||
    state.members.length > 0 ||
    state.statuses.length > 0 ||
    state.dueBuckets.length > 0 ||
    state.labelIds.length > 0 ||
    state.activityBuckets.length > 0 ||
    state.collapseEmptyLists
  );
}

export function applyBoardFiltersToLists(
  lists: ListWithCards[],
  state: BoardFilterState,
  context: {
    now?: Date;
    viewerId: string;
  },
): ListWithCards[] {
  if (!hasActiveBoardFilters(state)) {
    return lists;
  }

  const cardFilterContext: CardFilterContext = {
    now: context.now ?? new Date(),
    state,
    viewerId: context.viewerId,
  };

  const filteredLists = lists.map((list) => {
    const filteredCards = list.cards.filter((card) => matchesCard(card, cardFilterContext));
    return {
      ...list,
      cards: filteredCards,
    };
  });

  if (!state.collapseEmptyLists) {
    return filteredLists;
  }

  return filteredLists.filter((list) => list.cards.length > 0);
}

export function buildBoardFilterLabelByIdMap(labels: LabelRecord[]): Map<string, LabelRecord> {
  return new Map(labels.map((label) => [label.id, label]));
}
