import type {
  ChecklistHitPayload,
  HitRecord,
  SupabaseServerClient,
} from "./search-service.types";
import { normalizeSearchText } from "./search-service.utils";

type ChecklistFetchArgs = {
  boardIds: string[];
  fuzzyLike: string;
  queryText: string;
  queryWindow: number;
  supabase: SupabaseServerClient;
};

function markExistingAsFuzzy(
  existing: HitRecord<ChecklistHitPayload>,
  searchableText: string | null,
) {
  existing.matchedFuzzy = true;
  if (searchableText) {
    existing.searchableText = searchableText;
  }
}

async function appendChecklistNameHits(args: {
  hitById: Map<string, HitRecord<ChecklistHitPayload>>;
  query: ChecklistFetchArgs;
}) {
  const { hitById, query } = args;
  const { data: checklistRows } = await query.supabase
    .from("card_checklists")
    .select("id, card_id, title, updated_at, cards!inner(board_id)")
    .in("cards.board_id", query.boardIds)
    .textSearch("search_vector", query.queryText, { config: "simple", type: "websearch" })
    .limit(query.queryWindow);

  for (const row of ((checklistRows ?? []) as Array<{
    card_id: string;
    id: string;
    title: string;
    updated_at: string | null;
  }>)) {
    const resultId = `checklist:${row.id}`;
    hitById.set(resultId, {
      matchedFts: true,
      matchedFuzzy: false,
      payload: {
        cardId: row.card_id,
        checklistId: row.id,
        checklistTitle: row.title,
        entryId: row.id,
        entryKind: "checklist",
        itemBody: null,
        updatedAt: row.updated_at,
      },
      searchableText: normalizeSearchText(row.title),
    });
  }

  const { data: fuzzyRows, error } = await query.supabase
    .from("card_checklists")
    .select("id, card_id, title, updated_at, search_text_normalized, cards!inner(board_id)")
    .in("cards.board_id", query.boardIds)
    .ilike("search_text_normalized", query.fuzzyLike)
    .limit(query.queryWindow);

  if (error) {
    return;
  }

  for (const row of ((fuzzyRows ?? []) as Array<{
    card_id: string;
    id: string;
    search_text_normalized: string | null;
    title: string;
    updated_at: string | null;
  }>)) {
    const resultId = `checklist:${row.id}`;
    const existing = hitById.get(resultId);
    if (existing) {
      markExistingAsFuzzy(existing, row.search_text_normalized);
      continue;
    }

    hitById.set(resultId, {
      matchedFts: false,
      matchedFuzzy: true,
      payload: {
        cardId: row.card_id,
        checklistId: row.id,
        checklistTitle: row.title,
        entryId: row.id,
        entryKind: "checklist",
        itemBody: null,
        updatedAt: row.updated_at,
      },
      searchableText: row.search_text_normalized ?? normalizeSearchText(row.title),
    });
  }
}

async function loadChecklistScope(args: ChecklistFetchArgs): Promise<{
  checklistIdToCardId: Map<string, string>;
  checklistIds: string[];
  checklistTitleById: Map<string, string>;
}> {
  const { data: scopedChecklistRows } = await args.supabase
    .from("card_checklists")
    .select("id, card_id, title, cards!inner(board_id)")
    .in("cards.board_id", args.boardIds);

  const scopedChecklists = (scopedChecklistRows ?? []) as Array<{ card_id: string; id: string; title: string }>;
  return {
    checklistIdToCardId: new Map(scopedChecklists.map((checklist) => [checklist.id, checklist.card_id])),
    checklistIds: scopedChecklists.map((checklist) => checklist.id),
    checklistTitleById: new Map(scopedChecklists.map((checklist) => [checklist.id, checklist.title])),
  };
}

async function appendChecklistItemHits(args: {
  checklistIdToCardId: Map<string, string>;
  checklistIds: string[];
  checklistTitleById: Map<string, string>;
  hitById: Map<string, HitRecord<ChecklistHitPayload>>;
  query: ChecklistFetchArgs;
}) {
  if (args.checklistIds.length < 1) {
    return;
  }

  const { data: itemFtsRows } = await args.query.supabase
    .from("card_checklist_items")
    .select("id, checklist_id, body, updated_at")
    .in("checklist_id", args.checklistIds)
    .textSearch("search_vector", args.query.queryText, { config: "simple", type: "websearch" })
    .limit(args.query.queryWindow);

  for (const row of ((itemFtsRows ?? []) as Array<{
    body: string;
    checklist_id: string;
    id: string;
    updated_at: string | null;
  }>)) {
    const cardId = args.checklistIdToCardId.get(row.checklist_id);
    if (!cardId) {
      continue;
    }

    const resultId = `checklist-item:${row.id}`;
    args.hitById.set(resultId, {
      matchedFts: true,
      matchedFuzzy: false,
      payload: {
        cardId,
        checklistId: row.checklist_id,
        checklistTitle: args.checklistTitleById.get(row.checklist_id) ?? "Checklist",
        entryId: row.id,
        entryKind: "item",
        itemBody: row.body,
        updatedAt: row.updated_at,
      },
      searchableText: normalizeSearchText(row.body),
    });
  }

  const { data: itemFuzzyRows, error } = await args.query.supabase
    .from("card_checklist_items")
    .select("id, checklist_id, body, updated_at, search_text_normalized")
    .in("checklist_id", args.checklistIds)
    .ilike("search_text_normalized", args.query.fuzzyLike)
    .limit(args.query.queryWindow);

  if (error) {
    return;
  }

  for (const row of ((itemFuzzyRows ?? []) as Array<{
    body: string;
    checklist_id: string;
    id: string;
    search_text_normalized: string | null;
    updated_at: string | null;
  }>)) {
    const cardId = args.checklistIdToCardId.get(row.checklist_id);
    if (!cardId) {
      continue;
    }

    const resultId = `checklist-item:${row.id}`;
    const existing = args.hitById.get(resultId);
    if (existing) {
      markExistingAsFuzzy(existing, row.search_text_normalized);
      continue;
    }

    args.hitById.set(resultId, {
      matchedFts: false,
      matchedFuzzy: true,
      payload: {
        cardId,
        checklistId: row.checklist_id,
        checklistTitle: args.checklistTitleById.get(row.checklist_id) ?? "Checklist",
        entryId: row.id,
        entryKind: "item",
        itemBody: row.body,
        updatedAt: row.updated_at,
      },
      searchableText: row.search_text_normalized ?? normalizeSearchText(row.body),
    });
  }
}

export async function fetchChecklistHits(
  args: ChecklistFetchArgs,
): Promise<Map<string, HitRecord<ChecklistHitPayload>>> {
  const hitById = new Map<string, HitRecord<ChecklistHitPayload>>();
  if (args.boardIds.length < 1) {
    return hitById;
  }

  await appendChecklistNameHits({
    hitById,
    query: args,
  });

  const scope = await loadChecklistScope(args);
  await appendChecklistItemHits({
    checklistIdToCardId: scope.checklistIdToCardId,
    checklistIds: scope.checklistIds,
    checklistTitleById: scope.checklistTitleById,
    hitById,
    query: args,
  });

  return hitById;
}
