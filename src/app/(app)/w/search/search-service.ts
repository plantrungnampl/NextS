import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase";

import {
  hasCardSpecificSearchFilters,
  parseSearchFilterStateFromParams,
  SEARCH_DUE_BUCKET_VALUES,
  type SearchFilterState,
} from "./search-filters";
import { loadCardSearchContext } from "./search-service-card-filters";
import { fetchAllSearchHits } from "./search-service-fetchers";
import { buildSearchItems } from "./search-service-results";
import {
  loadBoardScope,
  loadSearchBootstrap,
  resolveWorkspaceScope,
} from "./search-service-scope";
import type { CardFilterContext, SearchQueryInput } from "./search-service.types";
import {
  buildFuzzyLikeValue,
  decodeCursorOffset,
  encodeCursorOffset,
  normalizeSearchText,
  sortSearchItems,
  toQueryLimit,
} from "./search-service.utils";
import type { SearchResponsePayload } from "./search-types";

function buildAppliedFilters(state: SearchFilterState, boardsHiddenByCardFilters: boolean) {
  return {
    boardsHiddenByCardFilters,
    due: state.due.filter((value) => SEARCH_DUE_BUCKET_VALUES.has(value)),
    labels: state.labels,
    match: state.match,
    members: state.members,
    q: state.q,
    status: state.status,
    type: state.type,
    workspace: state.workspace,
  };
}

function createEmptyResponse(appliedFilters: SearchResponsePayload["appliedFilters"]): SearchResponsePayload {
  return {
    appliedFilters,
    items: [],
    nextCursor: null,
  };
}

function createCardFilterContext(args: {
  cardContext: Awaited<ReturnType<typeof loadCardSearchContext>>;
  state: SearchFilterState;
  userId: string;
}): CardFilterContext {
  return {
    assigneeIdsByCardId: args.cardContext.assigneeIdsByCardId,
    labelIdsByCardId: args.cardContext.labelIdsByCardId,
    now: new Date(),
    state: args.state,
    viewerId: args.userId,
  };
}

function resolveQueryWindow(offset: number, limit: number): number {
  return Math.min(240, offset + limit * 6 + 40);
}

export { loadSearchBootstrap };

export async function searchWorkspaceContent(input: SearchQueryInput): Promise<SearchResponsePayload> {
  const state = parseSearchFilterStateFromParams(input.rawSearchParams);
  const normalizedQuery = normalizeSearchText(state.q);
  const boardsHiddenByCardFilters = hasCardSpecificSearchFilters(state);
  const appliedFilters = buildAppliedFilters(state, boardsHiddenByCardFilters);
  const limit = toQueryLimit(input.limit);
  const offset = decodeCursorOffset(input.cursor);

  if (normalizedQuery.length < 2) {
    return createEmptyResponse(appliedFilters);
  }

  const supabase = await createServerSupabaseClient();
  const scope = await resolveWorkspaceScope(
    supabase,
    input.userId,
    state.workspace.length > 0 ? state.workspace : undefined,
  );
  if (scope.workspaceIds.length < 1) {
    return createEmptyResponse(appliedFilters);
  }

  const boardScopeRows = await loadBoardScope(supabase, scope.workspaceIds);
  const boardIds = boardScopeRows.map((board) => board.id);
  if (boardIds.length < 1) {
    return createEmptyResponse(appliedFilters);
  }

  const queryWindow = resolveQueryWindow(offset, limit);
  const hits = await fetchAllSearchHits({
    boardIds,
    boardScopeRows,
    fuzzyLike: buildFuzzyLikeValue(normalizedQuery),
    normalizedQuery,
    queryText: state.q,
    queryWindow,
    supabase,
  });

  const cardContext = await loadCardSearchContext({
    hits,
    state,
    supabase,
  });
  const filterContext = createCardFilterContext({
    cardContext,
    state,
    userId: input.userId,
  });

  const items = buildSearchItems({
    boardScopeRows,
    boardsHiddenByCardFilters,
    cardById: cardContext.cardById,
    filterContext,
    hits,
    normalizedQuery,
    scope,
    state,
  });

  sortSearchItems(items);

  const pageItems = items.slice(offset, offset + limit);
  const nextCursor = offset + limit < items.length ? encodeCursorOffset(offset + limit) : null;

  return {
    appliedFilters,
    items: pageItems,
    nextCursor,
  };
}
