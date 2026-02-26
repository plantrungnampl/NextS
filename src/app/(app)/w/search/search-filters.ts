export type SearchEntityType =
  | "all"
  | "attachment"
  | "board"
  | "card"
  | "checklist"
  | "comment";

export type SearchMatchMode = "all" | "any";
export type SearchCardStatus = "completed" | "not-completed";
export type SearchDueBucket =
  | "due-next-30-days"
  | "due-next-7-days"
  | "due-tomorrow"
  | "no-due-date"
  | "overdue";

export const SEARCH_MEMBER_NO_MEMBER = "none";
export const SEARCH_MEMBER_ASSIGNED_TO_ME = "me";
export const SEARCH_LABEL_NO_LABEL = "none";

export const SEARCH_CARD_STATUS_VALUES = new Set<SearchCardStatus>([
  "completed",
  "not-completed",
]);

export const SEARCH_DUE_BUCKET_VALUES = new Set<SearchDueBucket>([
  "due-next-30-days",
  "due-next-7-days",
  "due-tomorrow",
  "no-due-date",
  "overdue",
]);

export type SearchFilterState = {
  due: SearchDueBucket[];
  labels: string[];
  match: SearchMatchMode;
  members: string[];
  q: string;
  status: SearchCardStatus[];
  type: SearchEntityType;
  workspace: string;
};

export const DEFAULT_SEARCH_FILTER_STATE: SearchFilterState = {
  due: [],
  labels: [],
  match: "any",
  members: [],
  q: "",
  status: [],
  type: "all",
  workspace: "",
};

type SearchFilterStateLike = Partial<SearchFilterState>;

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length < 1 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function parseCsv(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return unique(value.split(","));
}

function clampQuery(query: string): string {
  return query.trim().slice(0, 120);
}

function parseType(value: string | null): SearchEntityType {
  switch (value) {
    case "attachment":
    case "board":
    case "card":
    case "checklist":
    case "comment":
      return value;
    default:
      return "all";
  }
}

function parseMatch(value: string | null): SearchMatchMode {
  return value === "all" ? "all" : "any";
}

export function hasCardSpecificSearchFilters(state: SearchFilterStateLike): boolean {
  return (
    (state.members?.length ?? 0) > 0
    || (state.labels?.length ?? 0) > 0
    || (state.due?.length ?? 0) > 0
    || (state.status?.length ?? 0) > 0
  );
}

export function parseSearchFilterStateFromParams(params: URLSearchParams): SearchFilterState {
  const members = parseCsv(params.get("members"));
  const labels = parseCsv(params.get("labels"));
  const due = parseCsv(params.get("due")).filter((value): value is SearchDueBucket =>
    SEARCH_DUE_BUCKET_VALUES.has(value as SearchDueBucket),
  );
  const status = parseCsv(params.get("status")).filter((value): value is SearchCardStatus =>
    SEARCH_CARD_STATUS_VALUES.has(value as SearchCardStatus),
  );

  return {
    due,
    labels,
    match: parseMatch(params.get("match")),
    members,
    q: clampQuery(params.get("q") ?? ""),
    status,
    type: parseType(params.get("type")),
    workspace: (params.get("workspace") ?? "").trim(),
  };
}

function setCsv(params: URLSearchParams, key: string, values: string[]) {
  if (values.length < 1) {
    params.delete(key);
    return;
  }

  params.set(key, values.join(","));
}

export function writeSearchFilterStateToParams(
  params: URLSearchParams,
  state: SearchFilterStateLike,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  const q = clampQuery(state.q ?? "");
  const workspace = (state.workspace ?? "").trim();
  const type = state.type ?? "all";
  const match = state.match ?? "any";
  const members = unique((state.members ?? []).map((value) => value.trim()));
  const labels = unique((state.labels ?? []).map((value) => value.trim()));
  const due = unique((state.due ?? []).filter((value) =>
    SEARCH_DUE_BUCKET_VALUES.has(value as SearchDueBucket),
  ));
  const status = unique((state.status ?? []).filter((value) =>
    SEARCH_CARD_STATUS_VALUES.has(value as SearchCardStatus),
  ));

  if (q.length > 0) {
    next.set("q", q);
  } else {
    next.delete("q");
  }

  if (workspace.length > 0) {
    next.set("workspace", workspace);
  } else {
    next.delete("workspace");
  }

  if (type !== "all") {
    next.set("type", type);
  } else {
    next.delete("type");
  }

  if (match !== "any") {
    next.set("match", match);
  } else {
    next.delete("match");
  }

  setCsv(next, "members", members);
  setCsv(next, "labels", labels);
  setCsv(next, "due", due);
  setCsv(next, "status", status);

  return next;
}
