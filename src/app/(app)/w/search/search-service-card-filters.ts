import type { SearchFilterState } from "./search-filters";
import {
  SEARCH_LABEL_NO_LABEL,
  SEARCH_MEMBER_ASSIGNED_TO_ME,
  SEARCH_MEMBER_NO_MEMBER,
} from "./search-filters";
import type {
  CardFilterContext,
  CardScopeRow,
  CardSearchContext,
  SearchHitCollections,
  SupabaseServerClient,
} from "./search-service.types";
import { resolveDueBucketMatches } from "./search-service.utils";

function matchesMembers(context: CardFilterContext, cardId: string): boolean {
  if (context.state.members.length < 1) {
    return true;
  }

  const assigneeIds = context.assigneeIdsByCardId.get(cardId) ?? new Set<string>();
  return context.state.members.some((member) => {
    if (member === SEARCH_MEMBER_NO_MEMBER) {
      return assigneeIds.size < 1;
    }
    if (member === SEARCH_MEMBER_ASSIGNED_TO_ME) {
      return assigneeIds.has(context.viewerId);
    }
    return assigneeIds.has(member);
  });
}

function matchesLabels(context: CardFilterContext, cardId: string): boolean {
  if (context.state.labels.length < 1) {
    return true;
  }

  const labelIds = context.labelIdsByCardId.get(cardId) ?? new Set<string>();
  return context.state.labels.some((labelId) => {
    if (labelId === SEARCH_LABEL_NO_LABEL) {
      return labelIds.size < 1;
    }
    return labelIds.has(labelId);
  });
}

function matchesDue(context: CardFilterContext, cardDueAt: string | null): boolean {
  if (context.state.due.length < 1) {
    return true;
  }

  const matches = resolveDueBucketMatches(cardDueAt, context.now);
  return context.state.due.some((bucket) => matches[bucket]);
}

function matchesStatus(context: CardFilterContext, isCompleted: boolean): boolean {
  if (context.state.status.length < 1) {
    return true;
  }

  return context.state.status.some((status) => (status === "completed" ? isCompleted : !isCompleted));
}

export function matchesCardFilters(
  context: CardFilterContext,
  params: { cardDueAt: string | null; cardId: string; isCompleted: boolean },
): boolean {
  const memberActive = context.state.members.length > 0;
  const labelActive = context.state.labels.length > 0;
  const dueActive = context.state.due.length > 0;
  const statusActive = context.state.status.length > 0;
  const activeCount = [memberActive, labelActive, dueActive, statusActive].filter(Boolean).length;
  if (activeCount < 1) {
    return true;
  }

  const memberPass = matchesMembers(context, params.cardId);
  const labelPass = matchesLabels(context, params.cardId);
  const duePass = matchesDue(context, params.cardDueAt);
  const statusPass = matchesStatus(context, params.isCompleted);

  if (context.state.match === "all") {
    return (
      (!memberActive || memberPass)
      && (!labelActive || labelPass)
      && (!dueActive || duePass)
      && (!statusActive || statusPass)
    );
  }

  const results: boolean[] = [];
  if (memberActive) {
    results.push(memberPass);
  }
  if (labelActive) {
    results.push(labelPass);
  }
  if (dueActive) {
    results.push(duePass);
  }
  if (statusActive) {
    results.push(statusPass);
  }

  return results.some(Boolean);
}

function collectCandidateCardIds(hits: SearchHitCollections): string[] {
  const cardIds = new Set<string>();
  for (const hit of hits.cardHits.values()) {
    cardIds.add(hit.payload.cardId);
  }
  for (const hit of hits.commentHits.values()) {
    cardIds.add(hit.payload.cardId);
  }
  for (const hit of hits.checklistHits.values()) {
    cardIds.add(hit.payload.cardId);
  }
  for (const hit of hits.attachmentHits.values()) {
    cardIds.add(hit.payload.cardId);
  }

  return Array.from(cardIds);
}

async function loadScopedCards(
  supabase: SupabaseServerClient,
  cardIds: string[],
): Promise<Map<string, CardScopeRow>> {
  if (cardIds.length < 1) {
    return new Map();
  }

  const { data: cardRows } = await supabase
    .from("cards")
    .select("id, board_id, title, due_at, is_completed, updated_at")
    .in("id", cardIds)
    .is("archived_at", null);

  return new Map(
    ((cardRows ?? []) as CardScopeRow[]).map((card) => [card.id, card]),
  );
}

async function loadAssigneeMap(
  supabase: SupabaseServerClient,
  cardIds: string[],
  state: SearchFilterState,
): Promise<Map<string, Set<string>>> {
  const assigneeIdsByCardId = new Map<string, Set<string>>();
  if (cardIds.length < 1 || state.members.length < 1) {
    return assigneeIdsByCardId;
  }

  const { data: assigneeRows } = await supabase
    .from("card_assignees")
    .select("card_id, user_id")
    .in("card_id", cardIds);

  for (const row of ((assigneeRows ?? []) as Array<{ card_id: string; user_id: string }>)) {
    const current = assigneeIdsByCardId.get(row.card_id) ?? new Set<string>();
    current.add(row.user_id);
    assigneeIdsByCardId.set(row.card_id, current);
  }

  return assigneeIdsByCardId;
}

async function loadLabelMap(
  supabase: SupabaseServerClient,
  cardIds: string[],
  state: SearchFilterState,
): Promise<Map<string, Set<string>>> {
  const labelIdsByCardId = new Map<string, Set<string>>();
  if (cardIds.length < 1 || state.labels.length < 1) {
    return labelIdsByCardId;
  }

  const { data: labelRows } = await supabase
    .from("card_labels")
    .select("card_id, label_id")
    .in("card_id", cardIds);

  for (const row of ((labelRows ?? []) as Array<{ card_id: string; label_id: string }>)) {
    const current = labelIdsByCardId.get(row.card_id) ?? new Set<string>();
    current.add(row.label_id);
    labelIdsByCardId.set(row.card_id, current);
  }

  return labelIdsByCardId;
}

export async function loadCardSearchContext(args: {
  hits: SearchHitCollections;
  state: SearchFilterState;
  supabase: SupabaseServerClient;
}): Promise<CardSearchContext> {
  const cardIds = collectCandidateCardIds(args.hits);
  const [cardById, assigneeIdsByCardId, labelIdsByCardId] = await Promise.all([
    loadScopedCards(args.supabase, cardIds),
    loadAssigneeMap(args.supabase, cardIds, args.state),
    loadLabelMap(args.supabase, cardIds, args.state),
  ]);

  return {
    assigneeIdsByCardId,
    cardById,
    labelIdsByCardId,
  };
}
