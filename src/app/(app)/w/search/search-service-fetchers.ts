import { fetchChecklistHits } from "./search-service-fetchers-checklist";
import type {
  AttachmentHitPayload,
  BoardHitPayload,
  BoardScopeRow,
  CardHitPayload,
  CommentHitPayload,
  HitRecord,
  SearchHitCollections,
  SupabaseServerClient,
} from "./search-service.types";
import {
  isMissingColumnError,
  normalizeSearchText,
} from "./search-service.utils";

type FetchBaseArgs = {
  boardIds: string[];
  fuzzyLike: string;
  queryText: string;
  queryWindow: number;
  supabase: SupabaseServerClient;
};

function markExistingAsFuzzy<T>(existing: HitRecord<T>, searchableText: string | null) {
  existing.matchedFuzzy = true;
  if (searchableText) {
    existing.searchableText = searchableText;
  }
}

async function fetchBoardHits(args: {
  boardScopeRows: BoardScopeRow[];
  fuzzyLike: string;
  normalizedQuery: string;
  queryText: string;
  queryWindow: number;
  supabase: SupabaseServerClient;
}): Promise<Map<string, HitRecord<BoardHitPayload>>> {
  const hitById = new Map<string, HitRecord<BoardHitPayload>>();
  if (args.boardScopeRows.length < 1) {
    return hitById;
  }

  const workspaceIds = Array.from(new Set(args.boardScopeRows.map((board) => board.workspace_id)));
  const { data: ftsRows } = await args.supabase
    .from("boards")
    .select("id, workspace_id, name, description, updated_at")
    .in("workspace_id", workspaceIds)
    .is("archived_at", null)
    .textSearch("search_vector", args.queryText, { config: "simple", type: "websearch" })
    .limit(args.queryWindow);

  for (const row of ((ftsRows ?? []) as Array<{
    description: string | null;
    id: string;
    name: string;
    updated_at: string | null;
    workspace_id: string;
  }>)) {
    hitById.set(row.id, {
      matchedFts: true,
      matchedFuzzy: false,
      payload: {
        description: row.description,
        id: row.id,
        name: row.name,
        updatedAt: row.updated_at,
        workspaceId: row.workspace_id,
      },
      searchableText: normalizeSearchText(`${row.name} ${row.description ?? ""}`),
    });
  }

  const { data: fuzzyRows, error: fuzzyError } = await args.supabase
    .from("boards")
    .select("id, workspace_id, name, description, updated_at, search_text_normalized")
    .in("workspace_id", workspaceIds)
    .is("archived_at", null)
    .ilike("search_text_normalized", args.fuzzyLike)
    .limit(args.queryWindow);

  if (fuzzyError && isMissingColumnError(fuzzyError, "search_text_normalized")) {
    const fallbackRows = args.boardScopeRows.filter((board) => {
      const normalizedSource = normalizeSearchText(board.name);
      return normalizedSource.includes(args.normalizedQuery);
    });

    for (const board of fallbackRows) {
      const existing = hitById.get(board.id);
      if (existing) {
        existing.matchedFuzzy = true;
        continue;
      }
      hitById.set(board.id, {
        matchedFts: false,
        matchedFuzzy: true,
        payload: {
          description: null,
          id: board.id,
          name: board.name,
          updatedAt: board.updated_at,
          workspaceId: board.workspace_id,
        },
        searchableText: normalizeSearchText(board.name),
      });
    }

    return hitById;
  }

  if (fuzzyError) {
    return hitById;
  }

  for (const row of ((fuzzyRows ?? []) as Array<{
    description: string | null;
    id: string;
    name: string;
    search_text_normalized: string | null;
    updated_at: string | null;
    workspace_id: string;
  }>)) {
    const existing = hitById.get(row.id);
    if (existing) {
      markExistingAsFuzzy(existing, row.search_text_normalized);
      continue;
    }

    hitById.set(row.id, {
      matchedFts: false,
      matchedFuzzy: true,
      payload: {
        description: row.description,
        id: row.id,
        name: row.name,
        updatedAt: row.updated_at,
        workspaceId: row.workspace_id,
      },
      searchableText: row.search_text_normalized ?? normalizeSearchText(`${row.name} ${row.description ?? ""}`),
    });
  }

  return hitById;
}

async function fetchCardHits(args: FetchBaseArgs): Promise<Map<string, HitRecord<CardHitPayload>>> {
  const hitById = new Map<string, HitRecord<CardHitPayload>>();
  if (args.boardIds.length < 1) {
    return hitById;
  }

  const { data: ftsRows } = await args.supabase
    .from("cards")
    .select("id, title, description, board_id, updated_at")
    .in("board_id", args.boardIds)
    .is("archived_at", null)
    .textSearch("search_vector", args.queryText, { config: "simple", type: "websearch" })
    .limit(args.queryWindow);

  for (const row of ((ftsRows ?? []) as Array<{
    description: string | null;
    id: string;
    title: string;
    updated_at: string | null;
  }>)) {
    hitById.set(row.id, {
      matchedFts: true,
      matchedFuzzy: false,
      payload: {
        cardId: row.id,
        description: row.description,
        title: row.title,
        updatedAt: row.updated_at,
      },
      searchableText: normalizeSearchText(`${row.title} ${row.description ?? ""}`),
    });
  }

  const { data: fuzzyRows, error } = await args.supabase
    .from("cards")
    .select("id, title, description, updated_at, search_text_normalized")
    .in("board_id", args.boardIds)
    .is("archived_at", null)
    .ilike("search_text_normalized", args.fuzzyLike)
    .limit(args.queryWindow);

  if (error) {
    return hitById;
  }

  for (const row of ((fuzzyRows ?? []) as Array<{
    description: string | null;
    id: string;
    search_text_normalized: string | null;
    title: string;
    updated_at: string | null;
  }>)) {
    const existing = hitById.get(row.id);
    if (existing) {
      markExistingAsFuzzy(existing, row.search_text_normalized);
      continue;
    }

    hitById.set(row.id, {
      matchedFts: false,
      matchedFuzzy: true,
      payload: {
        cardId: row.id,
        description: row.description,
        title: row.title,
        updatedAt: row.updated_at,
      },
      searchableText: row.search_text_normalized ?? normalizeSearchText(`${row.title} ${row.description ?? ""}`),
    });
  }

  return hitById;
}

async function fetchCommentHits(args: FetchBaseArgs): Promise<Map<string, HitRecord<CommentHitPayload>>> {
  const hitById = new Map<string, HitRecord<CommentHitPayload>>();
  if (args.boardIds.length < 1) {
    return hitById;
  }

  const { data: ftsRows } = await args.supabase
    .from("card_comments")
    .select("id, card_id, body, updated_at, cards!inner(board_id)")
    .in("cards.board_id", args.boardIds)
    .textSearch("search_vector", args.queryText, { config: "simple", type: "websearch" })
    .limit(args.queryWindow);

  for (const row of ((ftsRows ?? []) as Array<{
    body: string;
    card_id: string;
    id: string;
    updated_at: string | null;
  }>)) {
    hitById.set(row.id, {
      matchedFts: true,
      matchedFuzzy: false,
      payload: {
        body: row.body,
        cardId: row.card_id,
        commentId: row.id,
        updatedAt: row.updated_at,
      },
      searchableText: normalizeSearchText(row.body),
    });
  }

  const { data: fuzzyRows, error } = await args.supabase
    .from("card_comments")
    .select("id, card_id, body, updated_at, search_text_normalized, cards!inner(board_id)")
    .in("cards.board_id", args.boardIds)
    .ilike("search_text_normalized", args.fuzzyLike)
    .limit(args.queryWindow);

  if (error) {
    return hitById;
  }

  for (const row of ((fuzzyRows ?? []) as Array<{
    body: string;
    card_id: string;
    id: string;
    search_text_normalized: string | null;
    updated_at: string | null;
  }>)) {
    const existing = hitById.get(row.id);
    if (existing) {
      markExistingAsFuzzy(existing, row.search_text_normalized);
      continue;
    }

    hitById.set(row.id, {
      matchedFts: false,
      matchedFuzzy: true,
      payload: {
        body: row.body,
        cardId: row.card_id,
        commentId: row.id,
        updatedAt: row.updated_at,
      },
      searchableText: row.search_text_normalized ?? normalizeSearchText(row.body),
    });
  }

  return hitById;
}

async function fetchAttachmentHits(args: FetchBaseArgs): Promise<Map<string, HitRecord<AttachmentHitPayload>>> {
  const hitById = new Map<string, HitRecord<AttachmentHitPayload>>();
  if (args.boardIds.length < 1) {
    return hitById;
  }

  const { data: ftsRows } = await args.supabase
    .from("attachments")
    .select("id, card_id, file_name, external_url, updated_at, cards!inner(board_id)")
    .in("cards.board_id", args.boardIds)
    .textSearch("search_vector", args.queryText, { config: "simple", type: "websearch" })
    .limit(args.queryWindow);

  for (const row of ((ftsRows ?? []) as Array<{
    card_id: string;
    external_url: string | null;
    file_name: string;
    id: string;
    updated_at: string | null;
  }>)) {
    hitById.set(row.id, {
      matchedFts: true,
      matchedFuzzy: false,
      payload: {
        attachmentId: row.id,
        cardId: row.card_id,
        externalUrl: row.external_url,
        fileName: row.file_name,
        updatedAt: row.updated_at,
      },
      searchableText: normalizeSearchText(`${row.file_name} ${row.external_url ?? ""}`),
    });
  }

  const { data: fuzzyRows, error } = await args.supabase
    .from("attachments")
    .select("id, card_id, file_name, external_url, updated_at, search_text_normalized, cards!inner(board_id)")
    .in("cards.board_id", args.boardIds)
    .ilike("search_text_normalized", args.fuzzyLike)
    .limit(args.queryWindow);

  if (error) {
    return hitById;
  }

  for (const row of ((fuzzyRows ?? []) as Array<{
    card_id: string;
    external_url: string | null;
    file_name: string;
    id: string;
    search_text_normalized: string | null;
    updated_at: string | null;
  }>)) {
    const existing = hitById.get(row.id);
    if (existing) {
      markExistingAsFuzzy(existing, row.search_text_normalized);
      continue;
    }

    hitById.set(row.id, {
      matchedFts: false,
      matchedFuzzy: true,
      payload: {
        attachmentId: row.id,
        cardId: row.card_id,
        externalUrl: row.external_url,
        fileName: row.file_name,
        updatedAt: row.updated_at,
      },
      searchableText: row.search_text_normalized ?? normalizeSearchText(`${row.file_name} ${row.external_url ?? ""}`),
    });
  }

  return hitById;
}

export async function fetchAllSearchHits(args: {
  boardIds: string[];
  boardScopeRows: BoardScopeRow[];
  fuzzyLike: string;
  normalizedQuery: string;
  queryText: string;
  queryWindow: number;
  supabase: SupabaseServerClient;
}): Promise<SearchHitCollections> {
  const baseArgs: FetchBaseArgs = {
    boardIds: args.boardIds,
    fuzzyLike: args.fuzzyLike,
    queryText: args.queryText,
    queryWindow: args.queryWindow,
    supabase: args.supabase,
  };

  const [boardHits, cardHits, commentHits, checklistHits, attachmentHits] = await Promise.all([
    fetchBoardHits({
      boardScopeRows: args.boardScopeRows,
      fuzzyLike: args.fuzzyLike,
      normalizedQuery: args.normalizedQuery,
      queryText: args.queryText,
      queryWindow: args.queryWindow,
      supabase: args.supabase,
    }),
    fetchCardHits(baseArgs),
    fetchCommentHits(baseArgs),
    fetchChecklistHits(baseArgs),
    fetchAttachmentHits(baseArgs),
  ]);

  return {
    attachmentHits,
    boardHits,
    cardHits,
    checklistHits,
    commentHits,
  };
}
