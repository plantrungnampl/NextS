import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase";

import type {
  AttachmentRecord,
  CardRichnessSnapshot,
  ChecklistRecord,
  ChecklistItemRecord,
  CommentRecord,
  LabelRecord,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "./types";
import { parseNumeric } from "./utils";

type ProfileRecord = {
  avatar_url: string | null;
  display_name: string;
  id: string;
};

type CardCommentRow = {
  body: string;
  created_at: string;
  created_by: string;
  id: string;
  updated_at: string;
};

type CardLabelRow = {
  labels?: unknown;
};

type CardAssigneeRow = {
  user_id: string;
};

type CardAttachmentRow = {
  content_type: string | null;
  created_at: string;
  created_by: string;
  external_url: string | null;
  file_name: string;
  id: string;
  size_bytes: number;
  source_type: "file" | "url";
  storage_path: string | null;
};

type CardChecklistRow = {
  card_id: string;
  id: string;
  position: number | string;
  title: string;
};

type CardChecklistItemRow = {
  body: string;
  checklist_id: string;
  id: string;
  is_done: boolean;
  position: number | string;
};

type CardRichnessRows = {
  assignees: CardAssigneeRow[];
  attachments: CardAttachmentRow[];
  checklists: CardChecklistRow[];
  checklistItems: CardChecklistItemRow[];
  comments: CardCommentRow[];
  labels: CardLabelRow[];
};

function normalizeDisplayName(rawName: string | null | undefined, fallbackId: string): string {
  const trimmed = (rawName ?? "").trim();
  if (trimmed.length > 0) {
    return trimmed;
  }

  return `user-${fallbackId.slice(0, 8)}`;
}

function extractNestedLabel(value: unknown): LabelRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    return extractNestedLabel(value[0]);
  }

  const candidate = value as { color?: unknown; id?: unknown; name?: unknown };
  if (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.color === "string"
  ) {
    return {
      color: candidate.color,
      id: candidate.id,
      name: candidate.name,
    };
  }

  return null;
}

async function fetchProfilesByIds(userIds: string[]): Promise<Map<string, ProfileRecord>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const supabase = await createServerSupabaseClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  if (error) {
    throw new Error(`Failed to load profiles: ${error.message}`);
  }

  return new Map(((profiles ?? []) as ProfileRecord[]).map((profile) => [profile.id, profile]));
}

async function resolveBoardContext(params: {
  boardId: string;
  workspaceSlug: string;
}): Promise<{ workspaceId: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, workspace_id, visibility")
    .eq("id", params.boardId)
    .is("archived_at", null)
    .maybeSingle();

  if (boardError) {
    throw new Error(`Failed to resolve board: ${boardError.message}`);
  }

  if (!board) {
    throw new Error("Board not found.");
  }

  const typedBoard = board as { visibility: "workspace" | "private" | "public"; workspace_id: string };
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", typedBoard.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Failed to verify workspace membership: ${membershipError.message}`);
  }

  const isWorkspaceMember = Boolean(membership);
  if (typedBoard.visibility !== "public" && !isWorkspaceMember) {
    throw new Error("Board not found or inaccessible.");
  }

  if (isWorkspaceMember) {
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", typedBoard.workspace_id)
      .eq("slug", params.workspaceSlug)
      .maybeSingle();

    if (workspaceError) {
      throw new Error(`Failed to resolve workspace: ${workspaceError.message}`);
    }

    if (!workspace) {
      throw new Error("Workspace not found or inaccessible.");
    }
  }

  return { workspaceId: typedBoard.workspace_id };
}

async function fetchAssigneeRolesById(params: {
  assigneeIds: string[];
  workspaceId: string;
}): Promise<Map<string, WorkspaceRole>> {
  if (params.assigneeIds.length === 0) {
    return new Map();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", params.workspaceId)
    .in("user_id", params.assigneeIds);

  if (error) {
    throw new Error(`Failed to load assignee roles: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as { role: WorkspaceRole; user_id: string }[]).map((entry) => [
      entry.user_id,
      entry.role,
    ]),
  );
}

async function ensureCardInBoard(params: { boardId: string; cardId: string }): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: card, error } = await supabase
    .from("cards")
    .select("id")
    .eq("id", params.cardId)
    .eq("board_id", params.boardId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve card: ${error.message}`);
  }

  if (!card) {
    throw new Error("Card not found.");
  }
}

async function fetchCardRichnessRows(cardId: string): Promise<CardRichnessRows> {
  const supabase = await createServerSupabaseClient();
  const [
    { data: commentsData, error: commentsError },
    { data: labelsData, error: labelsError },
    { data: assigneesData, error: assigneesError },
    { data: attachmentsData, error: attachmentsError },
    { data: checklistsData, error: checklistsError },
  ] = await Promise.all([
    supabase
      .from("card_comments")
      .select("id, body, created_by, created_at, updated_at")
      .eq("card_id", cardId)
      .order("created_at", { ascending: true }),
    supabase.from("card_labels").select("labels(id, name, color)").eq("card_id", cardId),
    supabase.from("card_assignees").select("user_id").eq("card_id", cardId),
    supabase
      .from("attachments")
      .select("id, storage_path, file_name, content_type, size_bytes, created_by, created_at, source_type, external_url")
      .eq("card_id", cardId)
      .order("created_at", { ascending: false }),
    supabase
      .from("card_checklists")
      .select("id, card_id, title, position")
      .eq("card_id", cardId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (commentsError) {
    throw new Error(`Failed to load card comments: ${commentsError.message}`);
  }
  if (labelsError) {
    throw new Error(`Failed to load card labels: ${labelsError.message}`);
  }
  if (assigneesError) {
    throw new Error(`Failed to load card assignees: ${assigneesError.message}`);
  }
  if (attachmentsError) {
    throw new Error(`Failed to load card attachments: ${attachmentsError.message}`);
  }
  if (checklistsError) {
    throw new Error(`Failed to load checklists: ${checklistsError.message}`);
  }

  const checklistRows = (checklistsData ?? []) as CardChecklistRow[];
  const checklistIds = checklistRows.map((entry) => entry.id);
  let checklistItemsRows: CardChecklistItemRow[] = [];
  if (checklistIds.length > 0) {
    const { data: checklistItemsData, error: checklistItemsError } = await supabase
      .from("card_checklist_items")
      .select("id, checklist_id, body, is_done, position")
      .in("checklist_id", checklistIds)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (checklistItemsError) {
      throw new Error(`Failed to load checklist items: ${checklistItemsError.message}`);
    }

    checklistItemsRows = (checklistItemsData ?? []) as CardChecklistItemRow[];
  }

  return {
    assignees: (assigneesData ?? []) as CardAssigneeRow[],
    attachments: (attachmentsData ?? []) as CardAttachmentRow[],
    checklists: checklistRows,
    checklistItems: checklistItemsRows,
    comments: (commentsData ?? []) as CardCommentRow[],
    labels: (labelsData ?? []) as CardLabelRow[],
  };
}

async function buildCardRichnessSnapshot(params: {
  rows: CardRichnessRows;
  workspaceId: string;
}): Promise<CardRichnessSnapshot> {
  const assigneeIds = Array.from(new Set(params.rows.assignees.map((entry) => entry.user_id)));
  const commentAuthorIds = Array.from(
    new Set(params.rows.comments.map((entry) => entry.created_by)),
  );
  const attachmentCreatorIds = Array.from(
    new Set(params.rows.attachments.map((entry) => entry.created_by)),
  );
  const profileIds = Array.from(
    new Set([...assigneeIds, ...commentAuthorIds, ...attachmentCreatorIds]),
  );
  const [profilesById, assigneeRolesById] = await Promise.all([
    fetchProfilesByIds(profileIds),
    fetchAssigneeRolesById({ assigneeIds, workspaceId: params.workspaceId }),
  ]);

  const comments: CommentRecord[] = params.rows.comments.map((entry) => {
    const author = profilesById.get(entry.created_by);
    return {
      authorAvatarUrl: author?.avatar_url ?? null,
      authorDisplayName: normalizeDisplayName(author?.display_name, entry.created_by),
      body: entry.body,
      createdAt: entry.created_at,
      createdBy: entry.created_by,
      id: entry.id,
      updatedAt: entry.updated_at,
    };
  });

  const labels: LabelRecord[] = [];
  for (const entry of params.rows.labels) {
    const label = extractNestedLabel(entry.labels);
    if (label) {
      labels.push(label);
    }
  }

  const assignees: WorkspaceMemberRecord[] = assigneeIds
    .map((userId) => {
      const profile = profilesById.get(userId);
      return {
        avatarUrl: profile?.avatar_url ?? null,
        displayName: normalizeDisplayName(profile?.display_name, userId),
        id: userId,
        role: assigneeRolesById.get(userId) ?? "member",
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  const attachments: AttachmentRecord[] = params.rows.attachments.map((entry) => ({
    contentType: entry.content_type,
    createdAt: entry.created_at,
    createdByAvatarUrl: profilesById.get(entry.created_by)?.avatar_url ?? null,
    createdByDisplayName: normalizeDisplayName(
      profilesById.get(entry.created_by)?.display_name,
      entry.created_by,
    ),
    createdBy: entry.created_by,
    externalUrl: entry.external_url,
    fileName: entry.file_name,
    id: entry.id,
    sizeBytes: entry.size_bytes,
    sourceType: entry.source_type === "url" ? "url" : "file",
    storagePath: entry.storage_path,
  }));

  const checklistItems: ChecklistItemRecord[] = params.rows.checklistItems.map((entry) => ({
    body: entry.body,
    checklistId: entry.checklist_id,
    id: entry.id,
    isDone: entry.is_done,
    position: parseNumeric(entry.position),
  }));
  const checklistItemsByChecklistId = new Map<string, ChecklistItemRecord[]>();
  for (const item of checklistItems) {
    const entries = checklistItemsByChecklistId.get(item.checklistId) ?? [];
    entries.push(item);
    checklistItemsByChecklistId.set(item.checklistId, entries);
  }
  const checklists: ChecklistRecord[] = params.rows.checklists
    .map((entry) => ({
      cardId: entry.card_id,
      id: entry.id,
      items: [...(checklistItemsByChecklistId.get(entry.id) ?? [])].sort(
        (left, right) => left.position - right.position,
      ),
      position: parseNumeric(entry.position),
      title: entry.title,
    }))
    .sort((left, right) => left.position - right.position);

  return {
    assignees,
    attachments,
    checklists,
    comments,
    labels,
  };
}

export async function getCardRichnessSnapshotData(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}): Promise<CardRichnessSnapshot> {
  const context = await resolveBoardContext({
    boardId: params.boardId,
    workspaceSlug: params.workspaceSlug,
  });
  await ensureCardInBoard({ boardId: params.boardId, cardId: params.cardId });
  const rows = await fetchCardRichnessRows(params.cardId);

  return buildCardRichnessSnapshot({
    rows,
    workspaceId: context.workspaceId,
  });
}
