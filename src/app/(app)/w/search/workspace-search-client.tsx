"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { Badge, Button, Input } from "@/components/ui";

import {
  parseSearchFilterStateFromParams,
  SEARCH_LABEL_NO_LABEL,
  SEARCH_MEMBER_ASSIGNED_TO_ME,
  SEARCH_MEMBER_NO_MEMBER,
  type SearchCardStatus,
  type SearchDueBucket,
  type SearchEntityType,
  type SearchFilterState,
  writeSearchFilterStateToParams,
} from "./search-filters";
import type {
  SearchBootstrapPayload,
  SearchLabelOption,
  SearchMemberOption,
  SearchResponsePayload,
} from "./search-types";
import { WorkspaceSearchResults } from "./workspace-search-results";

const SEARCH_TYPE_OPTIONS: Array<{ label: string; value: SearchEntityType }> = [
  { label: "Tất cả", value: "all" },
  { label: "Bảng", value: "board" },
  { label: "Thẻ", value: "card" },
  { label: "Bình luận", value: "comment" },
  { label: "Checklist", value: "checklist" },
  { label: "Tệp", value: "attachment" },
];

const DUE_OPTIONS: Array<{ label: string; value: SearchDueBucket }> = [
  { label: "Quá hạn", value: "overdue" },
  { label: "Ngày mai", value: "due-tomorrow" },
  { label: "7 ngày tới", value: "due-next-7-days" },
  { label: "30 ngày tới", value: "due-next-30-days" },
  { label: "Không ngày hạn", value: "no-due-date" },
];

const STATUS_OPTIONS: Array<{ label: string; value: SearchCardStatus }> = [
  { label: "Chưa hoàn thành", value: "not-completed" },
  { label: "Đã hoàn thành", value: "completed" },
];

function stateToQueryString(state: SearchFilterState): string {
  const params = writeSearchFilterStateToParams(new URLSearchParams(), state);
  return params.toString();
}

function toggleMultiValue(values: string[], target: string): string[] {
  return values.includes(target)
    ? values.filter((value) => value !== target)
    : [...values, target];
}

function resolveMemberOptions(payload: SearchBootstrapPayload, workspaceSlug: string): SearchMemberOption[] {
  const source = workspaceSlug
    ? payload.memberOptionsByWorkspaceSlug[workspaceSlug] ?? []
    : Object.values(payload.memberOptionsByWorkspaceSlug).flat();

  const uniqueById = new Map<string, SearchMemberOption>();
  for (const member of source) {
    uniqueById.set(member.id, member);
  }

  return Array.from(uniqueById.values()).sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

function resolveLabelOptions(payload: SearchBootstrapPayload, workspaceSlug: string): SearchLabelOption[] {
  const source = workspaceSlug
    ? payload.labelOptionsByWorkspaceSlug[workspaceSlug] ?? []
    : Object.values(payload.labelOptionsByWorkspaceSlug).flat();

  const uniqueById = new Map<string, SearchLabelOption>();
  for (const label of source) {
    uniqueById.set(label.id, label);
  }

  return Array.from(uniqueById.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function SearchTypeTabs(props: {
  onChange: (nextType: SearchEntityType) => void;
  value: SearchEntityType;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SEARCH_TYPE_OPTIONS.map((option) => (
        <button
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
            props.value === option.value
              ? "border-sky-500 bg-sky-500/15 text-sky-100"
              : "border-slate-600 bg-[#111722] text-slate-300 hover:border-slate-500"
          }`}
          key={option.value}
          onClick={() => props.onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MultiCheckboxGroup(props: {
  onToggle: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  selectedValues: string[];
  title: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-slate-700 bg-[#111722] p-3">
      <p className="text-xs font-semibold text-slate-200">{props.title}</p>
      <div className="grid gap-1.5 md:grid-cols-2">
        {props.options.map((option) => (
          <label
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800/70"
            key={option.value}
          >
            <input
              checked={props.selectedValues.includes(option.value)}
              className="h-3.5 w-3.5 rounded border-slate-500 bg-transparent"
              onChange={() => props.onToggle(option.value)}
              type="checkbox"
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SearchFilterPanel(props: {
  labelOptions: SearchLabelOption[];
  memberOptions: SearchMemberOption[];
  onStateChange: (updater: (prev: SearchFilterState) => SearchFilterState) => void;
  state: SearchFilterState;
  workspaces: SearchBootstrapPayload["workspaces"];
}) {
  const activeFilterCount =
    props.state.members.length + props.state.labels.length + props.state.due.length + props.state.status.length;

  const memberOptionRows = useMemo(
    () => [
      { label: "Gán cho tôi", value: SEARCH_MEMBER_ASSIGNED_TO_ME },
      { label: "Không thành viên", value: SEARCH_MEMBER_NO_MEMBER },
      ...props.memberOptions.map((member) => ({
        label: member.displayName,
        value: member.id,
      })),
    ],
    [props.memberOptions],
  );

  const labelOptionRows = useMemo(
    () => [
      { label: "Không nhãn", value: SEARCH_LABEL_NO_LABEL },
      ...props.labelOptions.map((label) => ({
        label: label.name,
        value: label.id,
      })),
    ],
    [props.labelOptions],
  );

  return (
    <div className="space-y-3 rounded-lg border border-slate-700 bg-[#141b29] p-3">
      <div className="grid gap-2 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Workspace</span>
          <select
            className="h-9 w-full rounded-md border border-slate-600 bg-[#0f141d] px-2 text-sm text-slate-100"
            onChange={(event) => props.onStateChange((prev) => ({
              ...prev,
              labels: [],
              members: [],
              workspace: event.target.value,
            }))}
            value={props.state.workspace}
          >
            <option value="">Tất cả workspace</option>
            {props.workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.slug}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-slate-400">Kết hợp bộ lọc</span>
          <select
            className="h-9 w-full rounded-md border border-slate-600 bg-[#0f141d] px-2 text-sm text-slate-100"
            onChange={(event) => props.onStateChange((prev) => ({
              ...prev,
              match: event.target.value === "all" ? "all" : "any",
            }))}
            value={props.state.match}
          >
            <option value="any">Khớp bất kỳ</option>
            <option value="all">Khớp tất cả</option>
          </select>
        </label>

        <div className="space-y-1">
          <span className="text-xs text-slate-400">Bộ lọc đang bật</span>
          <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-slate-700 bg-[#0f141d] px-2 py-1">
            {activeFilterCount > 0 ? <Badge variant="outline">{activeFilterCount}</Badge> : (
              <span className="text-xs text-slate-500">Chưa có</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MultiCheckboxGroup
          onToggle={(value) => props.onStateChange((prev) => ({
            ...prev,
            members: toggleMultiValue(prev.members, value),
          }))}
          options={memberOptionRows}
          selectedValues={props.state.members}
          title="Thành viên"
        />
        <MultiCheckboxGroup
          onToggle={(value) => props.onStateChange((prev) => ({
            ...prev,
            labels: toggleMultiValue(prev.labels, value),
          }))}
          options={labelOptionRows}
          selectedValues={props.state.labels}
          title="Nhãn"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MultiCheckboxGroup
          onToggle={(value) => props.onStateChange((prev) => ({
            ...prev,
            due: toggleMultiValue(prev.due, value) as SearchDueBucket[],
          }))}
          options={DUE_OPTIONS}
          selectedValues={props.state.due}
          title="Ngày hạn"
        />
        <MultiCheckboxGroup
          onToggle={(value) => props.onStateChange((prev) => ({
            ...prev,
            status: toggleMultiValue(prev.status, value) as SearchCardStatus[],
          }))}
          options={STATUS_OPTIONS}
          selectedValues={props.state.status}
          title="Trạng thái thẻ"
        />
      </div>
    </div>
  );
}

function WorkspaceSearchHeader(props: {
  onQueryChange: (value: string) => void;
  onReset: () => void;
  onTypeChange: (nextType: SearchEntityType) => void;
  queryValue: string;
  type: SearchEntityType;
}) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Tìm kiếm workspace</h1>
          <p className="text-sm text-slate-400">FTS + fuzzy tìm bảng, thẻ, bình luận, checklist và tệp đính kèm.</p>
        </div>
        <Badge className="border-slate-600 bg-slate-800 text-slate-300" variant="outline">
          <Search className="mr-1 h-3.5 w-3.5" />
          Search v2
        </Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          className="h-10 border-slate-600 bg-[#0f141d] text-slate-100 placeholder:text-slate-500"
          defaultValue={props.queryValue}
          key={`workspace-search-input:${props.queryValue}`}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="Tìm theo tên, mô tả, bình luận..."
        />
        <Button
          className="h-10"
          onClick={props.onReset}
          type="button"
          variant="ghost"
        >
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          Reset filter
        </Button>
      </div>

      <SearchTypeTabs onChange={props.onTypeChange} value={props.type} />
    </header>
  );
}

function useWorkspaceSearchData(args: {
  queryText: string;
  serializedFilters: string;
}) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const searchQuery = useInfiniteQuery<SearchResponsePayload>({
    enabled: args.queryText.trim().length >= 2,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams(args.serializedFilters);
      params.set("limit", "24");
      if (typeof pageParam === "string" && pageParam.length > 0) {
        params.set("cursor", pageParam);
      }

      const response = await fetch(`/api/search/workspace?${params.toString()}`, { method: "GET" });
      if (!response.ok) {
        throw new Error("SEARCH_FAILED");
      }

      return (await response.json()) as SearchResponsePayload;
    },
    queryKey: ["workspace-search", args.serializedFilters],
    retry: 1,
  });

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !searchQuery.hasNextPage || searchQuery.isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void searchQuery.fetchNextPage();
      }
    }, { rootMargin: "220px" });

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [searchQuery.fetchNextPage, searchQuery.hasNextPage, searchQuery.isFetchingNextPage]);

  const items = useMemo(
    () => (searchQuery.data?.pages ?? []).flatMap((page) => page.items),
    [searchQuery.data?.pages],
  );

  return {
    items,
    loadMoreRef,
    responseMeta: searchQuery.data?.pages?.[0]?.appliedFilters ?? null,
    searchQuery,
  };
}

function WorkspaceSearchClientView(props: {
  bootstrap: SearchBootstrapPayload;
  paramsSnapshot: string;
  state: SearchFilterState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSearchState = useCallback((updater: (prev: SearchFilterState) => SearchFilterState) => {
    const sourceSearch = typeof window === "undefined" ? props.paramsSnapshot : window.location.search;
    const currentParams = new URLSearchParams(sourceSearch);
    const currentState = parseSearchFilterStateFromParams(currentParams);
    const nextState = updater(currentState);
    const nextParams = writeSearchFilterStateToParams(
      new URLSearchParams(currentParams.toString()),
      nextState,
    );

    const currentQueryString = currentParams.toString();
    const nextQueryString = nextParams.toString();
    if (nextQueryString === currentQueryString) {
      return;
    }

    const href = nextQueryString.length > 0 ? `${pathname}?${nextQueryString}` : pathname;
    router.replace(href, { scroll: false });
  }, [pathname, props.paramsSnapshot, router]);

  const onQueryChange = useCallback((value: string) => {
    if (queryDebounceTimerRef.current) {
      clearTimeout(queryDebounceTimerRef.current);
    }

    queryDebounceTimerRef.current = setTimeout(() => {
      updateSearchState((prev) => ({
        ...prev,
        q: value,
      }));
      queryDebounceTimerRef.current = null;
    }, 280);
  }, [updateSearchState]);

  useEffect(() => () => {
    if (queryDebounceTimerRef.current) {
      clearTimeout(queryDebounceTimerRef.current);
    }
  }, []);

  const serializedFilters = useMemo(() => stateToQueryString(props.state), [props.state]);
  const memberOptions = useMemo(
    () => resolveMemberOptions(props.bootstrap, props.state.workspace),
    [props.bootstrap, props.state.workspace],
  );
  const labelOptions = useMemo(
    () => resolveLabelOptions(props.bootstrap, props.state.workspace),
    [props.bootstrap, props.state.workspace],
  );
  const { items, loadMoreRef, responseMeta, searchQuery } = useWorkspaceSearchData({
    queryText: props.state.q,
    serializedFilters,
  });

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-[#161d2b] p-4 text-slate-100">
      <WorkspaceSearchHeader
        onQueryChange={onQueryChange}
        onReset={() => updateSearchState((prev) => ({
          ...prev,
          due: [],
          labels: [],
          match: "any",
          members: [],
          status: [],
          type: "all",
          workspace: "",
        }))}
        onTypeChange={(nextType) => updateSearchState((prev) => ({
          ...prev,
          type: nextType,
        }))}
        queryValue={props.state.q}
        type={props.state.type}
      />

      <SearchFilterPanel
        labelOptions={labelOptions}
        memberOptions={memberOptions}
        onStateChange={updateSearchState}
        state={props.state}
        workspaces={props.bootstrap.workspaces}
      />

      <WorkspaceSearchResults
        hasNextPage={Boolean(searchQuery.hasNextPage)}
        isError={searchQuery.isError}
        isFetchingNextPage={searchQuery.isFetchingNextPage}
        isLoading={searchQuery.isLoading}
        items={items}
        loadMoreRef={loadMoreRef}
        onLoadMore={() => {
          if (!searchQuery.hasNextPage || searchQuery.isFetchingNextPage) {
            return;
          }
          void searchQuery.fetchNextPage();
        }}
        query={props.state.q}
        responseMeta={responseMeta}
      />
    </section>
  );
}

export function WorkspaceSearchClient(props: {
  bootstrap: SearchBootstrapPayload;
  initialState: SearchFilterState;
}) {
  const searchParams = useSearchParams();
  const paramsSnapshot = searchParams.toString();
  const urlState = useMemo(
    () => parseSearchFilterStateFromParams(new URLSearchParams(paramsSnapshot)),
    [paramsSnapshot],
  );
  const state = paramsSnapshot.length > 0 ? urlState : props.initialState;

  return (
    <WorkspaceSearchClientView
      bootstrap={props.bootstrap}
      paramsSnapshot={paramsSnapshot}
      state={state}
    />
  );
}
