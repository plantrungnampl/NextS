import { createServerSupabaseClient } from "@/lib/supabase";

import type { SearchFilterState } from "./search-filters";
import type { WorkspaceOption } from "./search-types";

export type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type SearchQueryInput = {
  cursor: string | null;
  limit: number;
  rawSearchParams: URLSearchParams;
  userId: string;
};

export type WorkspaceScope = {
  scopedWorkspaces: WorkspaceOption[];
  workspaceById: Map<string, WorkspaceOption>;
  workspaceIds: string[];
};

export type BoardScopeRow = {
  id: string;
  name: string;
  updated_at: string | null;
  workspace_id: string;
};

export type CardScopeRow = {
  board_id: string;
  due_at: string | null;
  id: string;
  is_completed: boolean;
  title: string;
  updated_at: string | null;
};

export type HitRecord<TPayload> = {
  matchedFts: boolean;
  matchedFuzzy: boolean;
  payload: TPayload;
  searchableText: string;
};

export type BoardHitPayload = {
  description: string | null;
  id: string;
  name: string;
  updatedAt: string | null;
  workspaceId: string;
};

export type CardHitPayload = {
  cardId: string;
  description: string | null;
  title: string;
  updatedAt: string | null;
};

export type CommentHitPayload = {
  body: string;
  cardId: string;
  commentId: string;
  updatedAt: string | null;
};

export type ChecklistHitPayload = {
  cardId: string;
  checklistId: string;
  checklistTitle: string;
  entryId: string;
  entryKind: "checklist" | "item";
  itemBody: string | null;
  updatedAt: string | null;
};

export type AttachmentHitPayload = {
  attachmentId: string;
  cardId: string;
  externalUrl: string | null;
  fileName: string;
  updatedAt: string | null;
};

export type SearchHitCollections = {
  attachmentHits: Map<string, HitRecord<AttachmentHitPayload>>;
  boardHits: Map<string, HitRecord<BoardHitPayload>>;
  cardHits: Map<string, HitRecord<CardHitPayload>>;
  checklistHits: Map<string, HitRecord<ChecklistHitPayload>>;
  commentHits: Map<string, HitRecord<CommentHitPayload>>;
};

export type CardFilterContext = {
  assigneeIdsByCardId: Map<string, Set<string>>;
  labelIdsByCardId: Map<string, Set<string>>;
  now: Date;
  state: SearchFilterState;
  viewerId: string;
};

export type CardSearchContext = {
  assigneeIdsByCardId: Map<string, Set<string>>;
  cardById: Map<string, CardScopeRow>;
  labelIdsByCardId: Map<string, Set<string>>;
};
