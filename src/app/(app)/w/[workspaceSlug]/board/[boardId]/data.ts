/* eslint-disable max-lines */
import "server-only";

import { notFound } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";

import type {
  BoardPageData,
  BoardRecord,
  CardRecord,
  ListRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
  WorkspaceRole,
} from "./types";
import {
  buildAssigneeIdsByCardId,
  buildAttachmentStatsByCardId,
  buildChecklistStatsByCardId,
  buildCountByCardId,
  buildLabelsByCardId,
  buildWatchStatsByCardId,
  normalizeDisplayName,
  toWorkspaceMemberRecord,
  type CardAssigneeLinkRow,
  type CardAttachmentLinkRow,
  type CardChecklistLinkRow,
  type CardCommentLinkRow,
  type CardLabelLinkRow,
  type CardWatcherLinkRow,
  type ProfileRecord,
} from "./data.card-utils";
import { fetchPrivateInboxCards } from "./data.private-inbox";
import { groupCardsByList, parseNumeric } from "./utils";

type CardCustomFieldRow = {
  effort: string | null;
  id: string;
  priority: string | null;
  status: string | null;
};

type CardCompletionRow = {
  completed_at: string | null;
  id: string;
  is_completed: boolean;
};

type CardTemplateRow = {
  id: string;
  is_template: boolean;
};

type CardScheduleRow = {
  has_due_time: boolean;
  has_start_time: boolean;
  id: string;
  recurrence_anchor_at: string | null;
  recurrence_rrule: string | null;
  recurrence_tz: string | null;
  reminder_offset_minutes: number | null;
  start_at: string | null;
};

type CardCoverRow = {
  cover_attachment_id: string | null;
  cover_color: string | null;
  cover_colorblind_friendly: boolean;
  cover_mode: "attachment" | "color" | "none" | null;
  cover_size: "full" | "header" | null;
  id: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type BoardContextRow = {
  comment_permission: "admins" | "members";
  created_by: string;
  description: string | null;
  edit_permission: "admins" | "members";
  id: string;
  member_manage_permission: "admins" | "members";
  name: string;
  show_card_cover_on_front: boolean;
  show_complete_status_on_front: boolean;
  sync_version: number | string;
  visibility: BoardRecord["visibility"];
  workspace_id: string;
};

type SupabaseQueryErrorLike = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message: string;
};

function isMissingTableSchemaCacheError(
  error: SupabaseQueryErrorLike | null,
  tableName: string,
): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST205" || error.code === "42P01") {
    return true;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes(tableName.toLowerCase()) &&
    (normalizedMessage.includes("schema cache") || normalizedMessage.includes("could not find the table"))
  );
}

function isMissingColumnSchemaError(
  error: SupabaseQueryErrorLike | null,
  columnNames: string[],
): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "42703") {
    return true;
  }

  const normalizedMessage = error.message.toLowerCase();
  return columnNames.some((columnName) => normalizedMessage.includes(columnName.toLowerCase()));
}

function resolveOptionalRowsFromTable<RowType>(params: {
  data: RowType[] | null;
  error: SupabaseQueryErrorLike | null;
  tableName: string;
}): RowType[] {
  if (!params.error) {
    return params.data ?? [];
  }

  if (isMissingTableSchemaCacheError(params.error, params.tableName)) {
    console.warn(
      `[board:data] optional relation '${params.tableName}' is unavailable; falling back to empty rows.`,
    );
    return [];
  }

  throw new Error(
    `Failed to load ${params.tableName}: ${params.error.message}`,
  );
}

function resolveOptionalCardCustomFieldRows(params: {
  cardIds: string[];
  data: CardCustomFieldRow[] | null;
  error: SupabaseQueryErrorLike | null;
}): CardCustomFieldRow[] {
  if (!params.error) {
    return params.data ?? [];
  }

  if (isMissingColumnSchemaError(params.error, ["status", "priority", "effort"])) {
    console.warn(
      "[board:data] optional card custom field columns are unavailable; falling back to null values.",
    );
    return params.cardIds.map((cardId) => ({
      effort: null,
      id: cardId,
      priority: null,
      status: null,
    }));
  }

  throw new Error(`Failed to load card custom fields: ${params.error.message}`);
}

function resolveOptionalCardCompletionRows(params: {
  cardIds: string[];
  data: CardCompletionRow[] | null;
  error: SupabaseQueryErrorLike | null;
}): CardCompletionRow[] {
  if (!params.error) {
    return params.data ?? [];
  }

  if (isMissingColumnSchemaError(params.error, ["is_completed", "completed_at"])) {
    console.warn(
      "[board:data] optional card completion columns are unavailable; falling back to incomplete state.",
    );
    return params.cardIds.map((cardId) => ({
      completed_at: null,
      id: cardId,
      is_completed: false,
    }));
  }

  throw new Error(`Failed to load card completion metadata: ${params.error.message}`);
}

function resolveOptionalCardTemplateRows(params: {
  cardIds: string[];
  data: CardTemplateRow[] | null;
  error: SupabaseQueryErrorLike | null;
}): CardTemplateRow[] {
  if (!params.error) {
    return params.data ?? [];
  }

  if (isMissingColumnSchemaError(params.error, ["is_template"])) {
    console.warn(
      "[board:data] optional card template column is unavailable; falling back to non-template cards.",
    );
    return params.cardIds.map((cardId) => ({
      id: cardId,
      is_template: false,
    }));
  }

  throw new Error(`Failed to load card template metadata: ${params.error.message}`);
}

function resolveOptionalCardScheduleRows(params: {
  cardIds: string[];
  data: CardScheduleRow[] | null;
  error: SupabaseQueryErrorLike | null;
}): CardScheduleRow[] {
  if (!params.error) {
    return params.data ?? [];
  }

  if (
    isMissingColumnSchemaError(params.error, [
      "start_at",
      "has_start_time",
      "has_due_time",
      "reminder_offset_minutes",
      "recurrence_rrule",
      "recurrence_anchor_at",
      "recurrence_tz",
    ])
  ) {
    console.warn(
      "[board:data] optional card schedule columns are unavailable; falling back to due-date-only metadata.",
    );
    return params.cardIds.map((cardId) => ({
      has_due_time: true,
      has_start_time: false,
      id: cardId,
      recurrence_anchor_at: null,
      recurrence_rrule: null,
      recurrence_tz: null,
      reminder_offset_minutes: null,
      start_at: null,
    }));
  }

  throw new Error(`Failed to load card schedule metadata: ${params.error.message}`);
}

function resolveOptionalCardCoverRows(params: {
  cardIds: string[];
  data: CardCoverRow[] | null;
  error: SupabaseQueryErrorLike | null;
}): CardCoverRow[] {
  if (!params.error) {
    return params.data ?? [];
  }

  if (
    isMissingColumnSchemaError(params.error, [
      "cover_attachment_id",
      "cover_mode",
      "cover_color",
      "cover_size",
      "cover_colorblind_friendly",
    ])
  ) {
    console.warn(
      "[board:data] optional card cover columns are unavailable; falling back to derived image cover.",
    );
    return params.cardIds.map((cardId) => ({
      cover_attachment_id: null,
      cover_color: null,
      cover_colorblind_friendly: false,
      cover_mode: null,
      cover_size: null,
      id: cardId,
    }));
  }

  throw new Error(`Failed to load card cover metadata: ${params.error.message}`);
}

async function fetchProfilesByIds(
  userIds: string[],
): Promise<Map<string, ProfileRecord>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const supabase = await createServerSupabaseClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  return new Map(
    ((profiles ?? []) as ProfileRecord[]).map((profile) => [profile.id, profile]),
  );
}

async function fetchWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMemberRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId);

  const typedMemberships = (memberships ?? []) as {
    role: WorkspaceRole;
    user_id: string;
  }[];
  const userIds = typedMemberships.map((entry) => entry.user_id);
  const profilesById = await fetchProfilesByIds(userIds);

  return typedMemberships
    .map((membership) => toWorkspaceMemberRecord(membership, profilesById))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function collectUnknownAssigneeIds(params: {
  assigneeIdsByCardId: Map<string, string[]>;
  workspaceMembersById: Map<string, WorkspaceMemberRecord>;
}): string[] {
  return Array.from(
    new Set(
      Array.from(params.assigneeIdsByCardId.values())
        .flat()
        .filter((userId) => !params.workspaceMembersById.has(userId)),
    ),
  );
}

// eslint-disable-next-line max-lines-per-function
export async function buildTypedCards(params: {
  rawCards: Array<{
    description: string | null;
    due_at: string | null;
    id: string;
    list_id: string;
    position: number | string;
    title: string;
    updated_at: string | null;
  }>;
  supabase: SupabaseServerClient;
  viewerId: string;
  workspaceMembersById: Map<string, WorkspaceMemberRecord>;
}): Promise<CardRecord[]> {
  const cardIds = params.rawCards.map((entry) => entry.id);
  if (cardIds.length === 0) {
    return [];
  }
  const [
    { data: cardLabelsData, error: cardLabelsError },
    { data: cardAssigneesData, error: cardAssigneesError },
    { data: cardCommentsData, error: cardCommentsError },
    { data: cardAttachmentsData, error: cardAttachmentsError },
    { data: cardChecklistData, error: cardChecklistError },
    { data: cardWatchersData, error: cardWatchersError },
    { data: cardCustomFieldsData, error: cardCustomFieldsError },
    { data: cardCompletionData, error: cardCompletionError },
    { data: cardTemplateData, error: cardTemplateError },
    { data: cardScheduleData, error: cardScheduleError },
    { data: cardCoverData, error: cardCoverError },
  ] = await Promise.all([
    params.supabase.from("card_labels").select("card_id, labels(id, name, color)").in("card_id", cardIds),
    params.supabase.from("card_assignees").select("card_id, user_id").in("card_id", cardIds),
    params.supabase.from("card_comments").select("card_id").in("card_id", cardIds),
    params.supabase.from("attachments").select("card_id, id, content_type").in("card_id", cardIds),
    params.supabase
      .from("card_checklist_items")
      .select("is_done, card_checklists!inner(card_id)")
      .in("card_checklists.card_id", cardIds),
    params.supabase.from("card_watchers").select("card_id, user_id").in("card_id", cardIds),
    params.supabase.from("cards").select("id, status, priority, effort").in("id", cardIds),
    params.supabase.from("cards").select("id, is_completed, completed_at").in("id", cardIds),
    params.supabase.from("cards").select("id, is_template").in("id", cardIds),
    params.supabase
      .from("cards")
      .select("id, start_at, has_start_time, has_due_time, reminder_offset_minutes, recurrence_rrule, recurrence_anchor_at, recurrence_tz")
      .in("id", cardIds),
    params.supabase
      .from("cards")
      .select("id, cover_attachment_id, cover_mode, cover_color, cover_size, cover_colorblind_friendly")
      .in("id", cardIds),
  ]);
  if (cardLabelsError) throw new Error(`Failed to load card labels: ${cardLabelsError.message}`);
  if (cardAssigneesError) throw new Error(`Failed to load card assignees: ${cardAssigneesError.message}`);
  if (cardCommentsError) throw new Error(`Failed to load card comments: ${cardCommentsError.message}`);
  if (cardAttachmentsError) throw new Error(`Failed to load card attachments: ${cardAttachmentsError.message}`);
  const checklistRows = resolveOptionalRowsFromTable<CardChecklistLinkRow>({
    data: (cardChecklistData ?? []) as CardChecklistLinkRow[],
    error: cardChecklistError,
    tableName: "card_checklist_items",
  });
  const watcherRows = resolveOptionalRowsFromTable<CardWatcherLinkRow>({
    data: (cardWatchersData ?? []) as CardWatcherLinkRow[],
    error: cardWatchersError,
    tableName: "card_watchers",
  });
  const customFieldRows = resolveOptionalCardCustomFieldRows({
    cardIds,
    data: (cardCustomFieldsData ?? []) as CardCustomFieldRow[],
    error: cardCustomFieldsError,
  });
  const completionRows = resolveOptionalCardCompletionRows({
    cardIds,
    data: (cardCompletionData ?? []) as CardCompletionRow[],
    error: cardCompletionError,
  });
  const templateRows = resolveOptionalCardTemplateRows({
    cardIds,
    data: (cardTemplateData ?? []) as CardTemplateRow[],
    error: cardTemplateError,
  });
  const scheduleRows = resolveOptionalCardScheduleRows({
    cardIds,
    data: (cardScheduleData ?? []) as CardScheduleRow[],
    error: cardScheduleError,
  });
  const coverRows = resolveOptionalCardCoverRows({
    cardIds,
    data: (cardCoverData ?? []) as CardCoverRow[],
    error: cardCoverError,
  });
  const labelsByCardId = buildLabelsByCardId((cardLabelsData ?? []) as CardLabelLinkRow[]);
  const assigneeIdsByCardId = buildAssigneeIdsByCardId((cardAssigneesData ?? []) as CardAssigneeLinkRow[]);
  const commentCountByCardId = buildCountByCardId((cardCommentsData ?? []) as CardCommentLinkRow[]);
  const { attachmentCountByCardId, coverAttachmentIdByCardId } = buildAttachmentStatsByCardId(
    (cardAttachmentsData ?? []) as CardAttachmentLinkRow[],
  );
  const { checklistCompletedCountByCardId, checklistTotalCountByCardId } = buildChecklistStatsByCardId(
    checklistRows,
  );
  const { watchCountByCardId, watchedCardIds } = buildWatchStatsByCardId(
    watcherRows,
    params.viewerId,
  );
  const customFieldsByCardId = new Map(customFieldRows.map((entry) => [entry.id, { effort: entry.effort, priority: entry.priority, status: entry.status }]));
  const completionByCardId = new Map(completionRows.map((entry) => [entry.id, { completedAt: entry.completed_at, isCompleted: entry.is_completed }]));
  const templateByCardId = new Map(templateRows.map((entry) => [entry.id, entry.is_template]));
  const scheduleByCardId = new Map(
    scheduleRows.map((entry) => [
      entry.id,
      {
        hasDueTime: entry.has_due_time,
        hasStartTime: entry.has_start_time,
        recurrenceAnchorAt: entry.recurrence_anchor_at,
        recurrenceRRule: entry.recurrence_rrule,
        recurrenceTz: entry.recurrence_tz,
        reminderOffsetMinutes: entry.reminder_offset_minutes,
        startAt: entry.start_at,
      },
    ]),
  );
  const coverByCardId = new Map(
    coverRows.map((entry) => [
      entry.id,
      {
        coverAttachmentId: entry.cover_attachment_id ?? null,
        coverColor: entry.cover_color ?? null,
        coverColorblindFriendly: entry.cover_colorblind_friendly === true,
        coverMode: entry.cover_mode,
        coverSize: entry.cover_size,
      },
    ]),
  );
  const unknownAssigneeIds = collectUnknownAssigneeIds({
    assigneeIdsByCardId,
    workspaceMembersById: params.workspaceMembersById,
  });
  const unknownAssigneeProfilesById = await fetchProfilesByIds(unknownAssigneeIds);
  return params.rawCards.map((entry) => ({
    ...(() => {
      const cover = coverByCardId.get(entry.id);
      const fallbackAttachmentId = coverAttachmentIdByCardId.get(entry.id) ?? null;
      const resolvedMode = cover?.coverMode
        ?? (cover?.coverAttachmentId || fallbackAttachmentId
          ? "attachment"
          : cover?.coverColor
            ? "color"
            : "none");
      return {
        coverAttachmentId: cover?.coverAttachmentId ?? fallbackAttachmentId,
        coverColor: cover?.coverColor ?? null,
        coverColorblindFriendly: cover?.coverColorblindFriendly ?? false,
        coverMode: resolvedMode,
        coverSize: cover?.coverSize ?? "full",
      };
    })(),
    assignees: (assigneeIdsByCardId.get(entry.id) ?? [])
      .map((assigneeId) => {
        const workspaceMember = params.workspaceMembersById.get(assigneeId);
        if (workspaceMember) {
          return workspaceMember;
        }

        const profile = unknownAssigneeProfilesById.get(assigneeId);
        return {
          avatarUrl: profile?.avatar_url ?? null,
          displayName: normalizeDisplayName(profile?.display_name, assigneeId),
          id: assigneeId,
          role: "member" as const,
        };
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    attachmentCount: attachmentCountByCardId.get(entry.id) ?? 0,
    attachments: [],
    checklistCompletedCount: checklistCompletedCountByCardId.get(entry.id) ?? 0,
    checklistTotalCount: checklistTotalCountByCardId.get(entry.id) ?? 0,
    commentCount: commentCountByCardId.get(entry.id) ?? 0,
    completed_at: completionByCardId.get(entry.id)?.completedAt ?? null,
    comments: [],
    description: entry.description,
    due_at: entry.due_at,
    effort: customFieldsByCardId.get(entry.id)?.effort ?? null,
    has_due_time: scheduleByCardId.get(entry.id)?.hasDueTime ?? true,
    has_start_time: scheduleByCardId.get(entry.id)?.hasStartTime ?? false,
    id: entry.id,
    is_completed: completionByCardId.get(entry.id)?.isCompleted ?? false,
    is_template: templateByCardId.get(entry.id) ?? false,
    labels: Array.from(labelsByCardId.get(entry.id)?.values() ?? []),
    list_id: entry.list_id,
    position: parseNumeric(entry.position),
    priority: customFieldsByCardId.get(entry.id)?.priority ?? null,
    recurrence_anchor_at: scheduleByCardId.get(entry.id)?.recurrenceAnchorAt ?? null,
    recurrence_rrule: scheduleByCardId.get(entry.id)?.recurrenceRRule ?? null,
    recurrence_tz: scheduleByCardId.get(entry.id)?.recurrenceTz ?? null,
    reminder_offset_minutes: scheduleByCardId.get(entry.id)?.reminderOffsetMinutes ?? null,
    start_at: scheduleByCardId.get(entry.id)?.startAt ?? null,
    status: customFieldsByCardId.get(entry.id)?.status ?? null,
    title: entry.title,
    updated_at: typeof entry.updated_at === "string" && !Number.isNaN(new Date(entry.updated_at).getTime())
      ? entry.updated_at
      : null,
    watchCount: watchCountByCardId.get(entry.id) ?? 0,
    watchedByViewer: watchedCardIds.has(entry.id),
  })) as CardRecord[];
}

// eslint-disable-next-line max-lines-per-function
export async function getBoardPageData(
  workspaceSlug: string,
  boardId: string,
): Promise<BoardPageData> {
  const { email: authEmail, userId } = await requireAuthContext();
  const supabase = await createServerSupabaseClient();
  const { data: boardWithSettings, error: boardWithSettingsError } = await supabase
    .from("boards")
    .select(
      "id, workspace_id, name, description, sync_version, visibility, created_by, edit_permission, comment_permission, member_manage_permission, show_complete_status_on_front, show_card_cover_on_front",
    )
    .eq("id", boardId)
    .is("archived_at", null)
    .maybeSingle();

  let boardContext: BoardContextRow | null = null;
  if (boardWithSettings) {
    boardContext = boardWithSettings as BoardContextRow;
  } else if (
    isMissingColumnSchemaError(boardWithSettingsError as SupabaseQueryErrorLike | null, [
      "edit_permission",
      "comment_permission",
      "member_manage_permission",
      "show_complete_status_on_front",
      "show_card_cover_on_front",
    ])
  ) {
    const { data: legacyBoard } = await supabase
      .from("boards")
      .select("id, workspace_id, name, description, sync_version, visibility, created_by")
      .eq("id", boardId)
      .is("archived_at", null)
      .maybeSingle();

    if (legacyBoard) {
      const typedLegacyBoard = legacyBoard as {
        created_by: string;
        description: string | null;
        id: string;
        name: string;
        sync_version: number | string;
        visibility: BoardRecord["visibility"];
        workspace_id: string;
      };
      boardContext = {
        comment_permission: "members",
        created_by: typedLegacyBoard.created_by,
        description: typedLegacyBoard.description,
        edit_permission: "members",
        id: typedLegacyBoard.id,
        member_manage_permission: "members",
        name: typedLegacyBoard.name,
        show_card_cover_on_front: true,
        show_complete_status_on_front: true,
        sync_version: typedLegacyBoard.sync_version,
        visibility: typedLegacyBoard.visibility,
        workspace_id: typedLegacyBoard.workspace_id,
      };
    }
  }
  if (!boardContext) notFound();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", boardContext.workspace_id)
    .eq("user_id", userId);
  const typedMembership = ((membership ?? []) as { role: Exclude<WorkspaceRole, "viewer"> }[])[0] ?? null;
  const { data: boardMembership } = await supabase
    .from("board_members")
    .select("role")
    .eq("board_id", boardContext.id)
    .eq("user_id", userId)
    .maybeSingle();
  const typedBoardMembership = (boardMembership as { role: "admin" | "member" | "viewer" } | null) ?? null;
  const canReadBoard = boardContext.visibility === "public"
    || boardContext.created_by === userId
    || typedMembership?.role === "owner"
    || typedMembership?.role === "admin"
    || typedBoardMembership !== null;
  if (!canReadBoard) notFound();
  const effectiveRole: WorkspaceRole = boardContext.created_by === userId
    ? "owner"
    : typedMembership?.role === "owner"
      ? "owner"
      : typedMembership?.role === "admin" || typedBoardMembership?.role === "admin"
        ? "admin"
        : typedBoardMembership?.role === "member"
          ? "member"
          : "viewer";
  const canWriteBoard = boardContext.created_by === userId
    || typedMembership?.role === "owner"
    || typedMembership?.role === "admin"
    || (
      boardContext.edit_permission === "admins"
        ? typedBoardMembership?.role === "admin"
        : typedBoardMembership?.role === "admin" || typedBoardMembership?.role === "member"
    );
  const { data: favoriteRows, error: favoriteRowsError } = await supabase
    .from("board_favorites")
    .select("board_id")
    .eq("board_id", boardContext.id)
    .eq("user_id", userId)
    .limit(1);
  const resolvedFavoriteRows = resolveOptionalRowsFromTable<{ board_id: string }>({
    data: (favoriteRows ?? []) as { board_id: string }[],
    error: favoriteRowsError as SupabaseQueryErrorLike | null,
    tableName: "board_favorites",
  });
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("id", boardContext.workspace_id)
    .eq("slug", workspaceSlug)
    .maybeSingle();
  if (!workspace) notFound();
  const typedWorkspace = workspace as WorkspaceRecord;
  const canAccessWorkspaceLabels = typedMembership !== null || boardContext.created_by === userId;
  const workspaceMembers = canAccessWorkspaceLabels ? await fetchWorkspaceMembers(typedWorkspace.id) : [];
  const workspaceMembersById = new Map(workspaceMembers.map((entry) => [entry.id, entry]));
  const viewer = workspaceMembersById.get(userId);
  const fallbackEmail = authEmail?.trim().toLowerCase() ?? "";

  const typedBoard = {
    commentPermission: boardContext.comment_permission,
    description: boardContext.description, id: boardContext.id, isFavorite: resolvedFavoriteRows.length > 0,
    editPermission: boardContext.edit_permission,
    memberManagePermission: boardContext.member_manage_permission,
    name: boardContext.name, syncVersion: parseNumeric(boardContext.sync_version), visibility: boardContext.visibility,
    showCardCoverOnFront: boardContext.show_card_cover_on_front,
    showCompleteStatusOnFront: boardContext.show_complete_status_on_front,
  } as BoardRecord;

  const { data: lists } = await supabase
    .from("lists")
    .select("id, title, position")
    .eq("board_id", typedBoard.id)
    .is("archived_at", null)
    .order("position", { ascending: true });
  const { data: cards } = await supabase
    .from("cards")
    .select("id, title, list_id, position, description, due_at, updated_at")
    .eq("board_id", typedBoard.id)
    .is("archived_at", null)
    .order("position", { ascending: true });
  const { data: labels } = canAccessWorkspaceLabels
    ? await supabase
      .from("labels")
      .select("id, name, color")
      .eq("workspace_id", typedWorkspace.id)
      .order("name", { ascending: true })
    : { data: [] as { color: string; id: string; name: string }[] };

  const typedLists = ((lists ?? []) as { id: string; position: number | string; title: string }[])
    .map((entry) => ({ id: entry.id, position: parseNumeric(entry.position), title: entry.title })) as ListRecord[];
  const rawCards = (cards ?? []) as Array<{
    description: string | null;
    due_at: string | null;
    id: string;
    list_id: string;
    position: number | string;
    title: string;
    updated_at: string | null;
  }>;
  const typedCards = await buildTypedCards({ rawCards, supabase, viewerId: userId, workspaceMembersById });
  const privateInboxCards = await fetchPrivateInboxCards({ boardId: typedBoard.id, cards: typedCards, supabase, userId });

  return {
    board: typedBoard,
    canWriteBoard,
    listsWithCards: groupCardsByList(typedLists, typedCards),
    membershipRole: effectiveRole,
    privateInboxCards,
    viewer: {
      displayName: viewer?.displayName ?? fallbackEmail.split("@")[0] ?? `user-${userId.slice(0, 8)}`,
      email: fallbackEmail,
      id: userId,
    },
    workspace: typedWorkspace,
    workspaceLabels: ((labels ?? []) as { color: string; id: string; name: string }[]).map((entry) => ({
      color: entry.color,
      id: entry.id,
      name: entry.name,
    })),
    workspaceMembers,
  };
}
