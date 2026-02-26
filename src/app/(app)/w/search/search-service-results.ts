import { APP_ROUTES } from "@/core";

import { matchesCardFilters } from "./search-service-card-filters";
import type {
  BoardScopeRow,
  CardFilterContext,
  CardScopeRow,
  SearchHitCollections,
  WorkspaceScope,
} from "./search-service.types";
import type { SearchFilterState, SearchEntityType } from "./search-filters";
import type { SearchResultItem } from "./search-types";
import {
  computeSearchScore,
  toIsoOrNull,
  toSearchItemIdentity,
  trimSnippet,
} from "./search-service.utils";

function allowEntity(type: SearchEntityType, entityType: SearchResultItem["entityType"]): boolean {
  if (type === "all") {
    return true;
  }
  return type === entityType;
}

function addBoardItems(args: {
  boardById: Map<string, BoardScopeRow>;
  boardsHiddenByCardFilters: boolean;
  hits: SearchHitCollections;
  items: SearchResultItem[];
  normalizedQuery: string;
  scope: WorkspaceScope;
  state: SearchFilterState;
}) {
  if (args.boardsHiddenByCardFilters || !allowEntity(args.state.type, "board")) {
    return;
  }

  for (const hit of args.hits.boardHits.values()) {
    const workspace = args.scope.workspaceById.get(hit.payload.workspaceId);
    if (!workspace) {
      continue;
    }

    args.items.push({
      board: { id: hit.payload.id, name: hit.payload.name },
      entityId: hit.payload.id,
      entityType: "board",
      href: APP_ROUTES.workspace.boardById(workspace.slug, hit.payload.id),
      id: toSearchItemIdentity("board", hit.payload.id),
      score: computeSearchScore({
        matchedFts: hit.matchedFts,
        queryNormalized: args.normalizedQuery,
        searchableText: hit.searchableText,
      }),
      snippet: trimSnippet(hit.payload.description),
      title: hit.payload.name,
      updatedAt: toIsoOrNull(hit.payload.updatedAt),
      workspace,
    });
  }
}

function resolveCardRoute(args: {
  boardById: Map<string, BoardScopeRow>;
  card: CardScopeRow;
  scope: WorkspaceScope;
}): { board: BoardScopeRow; href: string; workspaceSlug: string } | null {
  const board = args.boardById.get(args.card.board_id);
  if (!board) {
    return null;
  }

  const workspace = args.scope.workspaceById.get(board.workspace_id);
  if (!workspace) {
    return null;
  }

  return {
    board,
    href: `${APP_ROUTES.workspace.boardById(workspace.slug, board.id)}?c=${encodeURIComponent(args.card.id)}`,
    workspaceSlug: workspace.slug,
  };
}

function addCardItems(args: {
  boardById: Map<string, BoardScopeRow>;
  cardById: Map<string, CardScopeRow>;
  filterContext: CardFilterContext;
  hits: SearchHitCollections;
  items: SearchResultItem[];
  normalizedQuery: string;
  scope: WorkspaceScope;
  state: SearchFilterState;
}) {
  if (!allowEntity(args.state.type, "card")) {
    return;
  }

  for (const hit of args.hits.cardHits.values()) {
    const card = args.cardById.get(hit.payload.cardId);
    if (!card) {
      continue;
    }
    if (!matchesCardFilters(args.filterContext, {
      cardDueAt: card.due_at,
      cardId: card.id,
      isCompleted: card.is_completed,
    })) {
      continue;
    }

    const route = resolveCardRoute({
      boardById: args.boardById,
      card,
      scope: args.scope,
    });
    if (!route) {
      continue;
    }

    const workspace = args.scope.workspaceById.get(route.board.workspace_id);
    if (!workspace) {
      continue;
    }

    args.items.push({
      board: { id: route.board.id, name: route.board.name },
      card: { id: card.id, title: card.title },
      entityId: card.id,
      entityType: "card",
      href: route.href,
      id: toSearchItemIdentity("card", card.id),
      score: computeSearchScore({
        matchedFts: hit.matchedFts,
        queryNormalized: args.normalizedQuery,
        searchableText: hit.searchableText,
      }),
      snippet: trimSnippet(hit.payload.description),
      title: card.title,
      updatedAt: toIsoOrNull(hit.payload.updatedAt ?? card.updated_at),
      workspace,
    });
  }
}

function addCommentItems(args: {
  boardById: Map<string, BoardScopeRow>;
  cardById: Map<string, CardScopeRow>;
  filterContext: CardFilterContext;
  hits: SearchHitCollections;
  items: SearchResultItem[];
  normalizedQuery: string;
  scope: WorkspaceScope;
  state: SearchFilterState;
}) {
  if (!allowEntity(args.state.type, "comment")) {
    return;
  }

  for (const hit of args.hits.commentHits.values()) {
    const card = args.cardById.get(hit.payload.cardId);
    if (!card) {
      continue;
    }
    if (!matchesCardFilters(args.filterContext, {
      cardDueAt: card.due_at,
      cardId: card.id,
      isCompleted: card.is_completed,
    })) {
      continue;
    }

    const route = resolveCardRoute({
      boardById: args.boardById,
      card,
      scope: args.scope,
    });
    if (!route) {
      continue;
    }

    const workspace = args.scope.workspaceById.get(route.board.workspace_id);
    if (!workspace) {
      continue;
    }

    args.items.push({
      board: { id: route.board.id, name: route.board.name },
      card: { id: card.id, title: card.title },
      entityId: hit.payload.commentId,
      entityType: "comment",
      href: route.href,
      id: toSearchItemIdentity("comment", hit.payload.commentId),
      score: computeSearchScore({
        matchedFts: hit.matchedFts,
        queryNormalized: args.normalizedQuery,
        searchableText: hit.searchableText,
      }),
      snippet: trimSnippet(hit.payload.body),
      title: `Comment on ${card.title}`,
      updatedAt: toIsoOrNull(hit.payload.updatedAt),
      workspace,
    });
  }
}

function addChecklistItems(args: {
  boardById: Map<string, BoardScopeRow>;
  cardById: Map<string, CardScopeRow>;
  filterContext: CardFilterContext;
  hits: SearchHitCollections;
  items: SearchResultItem[];
  normalizedQuery: string;
  scope: WorkspaceScope;
  state: SearchFilterState;
}) {
  if (!allowEntity(args.state.type, "checklist")) {
    return;
  }

  for (const hit of args.hits.checklistHits.values()) {
    const card = args.cardById.get(hit.payload.cardId);
    if (!card) {
      continue;
    }
    if (!matchesCardFilters(args.filterContext, {
      cardDueAt: card.due_at,
      cardId: card.id,
      isCompleted: card.is_completed,
    })) {
      continue;
    }

    const route = resolveCardRoute({
      boardById: args.boardById,
      card,
      scope: args.scope,
    });
    if (!route) {
      continue;
    }

    const workspace = args.scope.workspaceById.get(route.board.workspace_id);
    if (!workspace) {
      continue;
    }

    const title = hit.payload.entryKind === "checklist"
      ? hit.payload.checklistTitle
      : `${hit.payload.checklistTitle} item`;
    const snippet = hit.payload.entryKind === "item"
      ? trimSnippet(hit.payload.itemBody)
      : null;

    args.items.push({
      board: { id: route.board.id, name: route.board.name },
      card: { id: card.id, title: card.title },
      entityId: hit.payload.entryId,
      entityType: "checklist",
      href: route.href,
      id: toSearchItemIdentity("checklist", hit.payload.entryId),
      score: computeSearchScore({
        matchedFts: hit.matchedFts,
        queryNormalized: args.normalizedQuery,
        searchableText: hit.searchableText,
      }),
      snippet,
      title,
      updatedAt: toIsoOrNull(hit.payload.updatedAt),
      workspace,
    });
  }
}

function addAttachmentItems(args: {
  boardById: Map<string, BoardScopeRow>;
  cardById: Map<string, CardScopeRow>;
  filterContext: CardFilterContext;
  hits: SearchHitCollections;
  items: SearchResultItem[];
  normalizedQuery: string;
  scope: WorkspaceScope;
  state: SearchFilterState;
}) {
  if (!allowEntity(args.state.type, "attachment")) {
    return;
  }

  for (const hit of args.hits.attachmentHits.values()) {
    const card = args.cardById.get(hit.payload.cardId);
    if (!card) {
      continue;
    }
    if (!matchesCardFilters(args.filterContext, {
      cardDueAt: card.due_at,
      cardId: card.id,
      isCompleted: card.is_completed,
    })) {
      continue;
    }

    const route = resolveCardRoute({
      boardById: args.boardById,
      card,
      scope: args.scope,
    });
    if (!route) {
      continue;
    }

    const workspace = args.scope.workspaceById.get(route.board.workspace_id);
    if (!workspace) {
      continue;
    }

    args.items.push({
      board: { id: route.board.id, name: route.board.name },
      card: { id: card.id, title: card.title },
      entityId: hit.payload.attachmentId,
      entityType: "attachment",
      href: route.href,
      id: toSearchItemIdentity("attachment", hit.payload.attachmentId),
      score: computeSearchScore({
        matchedFts: hit.matchedFts,
        queryNormalized: args.normalizedQuery,
        searchableText: hit.searchableText,
      }),
      snippet: trimSnippet(hit.payload.externalUrl),
      title: hit.payload.fileName,
      updatedAt: toIsoOrNull(hit.payload.updatedAt),
      workspace,
    });
  }
}

export function buildSearchItems(args: {
  boardScopeRows: BoardScopeRow[];
  boardsHiddenByCardFilters: boolean;
  cardById: Map<string, CardScopeRow>;
  filterContext: CardFilterContext;
  hits: SearchHitCollections;
  normalizedQuery: string;
  scope: WorkspaceScope;
  state: SearchFilterState;
}): SearchResultItem[] {
  const items: SearchResultItem[] = [];
  const boardById = new Map(args.boardScopeRows.map((board) => [board.id, board]));

  addBoardItems({
    boardById,
    boardsHiddenByCardFilters: args.boardsHiddenByCardFilters,
    hits: args.hits,
    items,
    normalizedQuery: args.normalizedQuery,
    scope: args.scope,
    state: args.state,
  });

  const sharedCardArgs = {
    boardById,
    cardById: args.cardById,
    filterContext: args.filterContext,
    hits: args.hits,
    items,
    normalizedQuery: args.normalizedQuery,
    scope: args.scope,
    state: args.state,
  };

  addCardItems(sharedCardArgs);
  addCommentItems(sharedCardArgs);
  addChecklistItems(sharedCardArgs);
  addAttachmentItems(sharedCardArgs);

  return items;
}
