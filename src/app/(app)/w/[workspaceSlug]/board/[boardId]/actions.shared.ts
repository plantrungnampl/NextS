import "server-only";

import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/core";
import { getOptionalAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";

import type {
  BoardPermissionLevel,
  BoardVisibility,
  CardRecord,
  ListRecord,
  WorkspaceRole,
} from "./types";
import { parseNumeric } from "./utils";

export type BoardAccess = {
  boardId: string;
  boardMembershipRole: "admin" | "member" | "viewer" | null;
  boardCommentPermission: BoardPermissionLevel;
  boardEditPermission: BoardPermissionLevel;
  boardMemberManagePermission: BoardPermissionLevel;
  boardVisibility: BoardVisibility;
  canCommentBoard: boolean;
  canManageAccess: boolean;
  canManageSettings: boolean;
  canWriteBoard: boolean;
  isBoardCreator: boolean;
  role: WorkspaceRole;
  userId: string;
  workspaceId: string;
};

type AccessRequirement = "read" | "write";

type ResolveBoardAccessOptions = {
  requiredPermission?: AccessRequirement;
};

type MembershipRecord = {
  role: Exclude<WorkspaceRole, "viewer">;
};

type BoardMembershipRecord = {
  role: "admin" | "member" | "viewer";
};

type BoardRecord = {
  comment_permission: BoardPermissionLevel;
  created_by: string;
  edit_permission: BoardPermissionLevel;
  id: string;
  member_manage_permission: BoardPermissionLevel;
  visibility: BoardVisibility;
  workspace_id: string;
};

type SupabaseErrorLike = { code?: string; message: string };

function isMissingBoardSettingsSchema(error: SupabaseErrorLike | null): boolean {
  if (!error) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  return error.code === "42703"
    || normalizedMessage.includes("edit_permission")
    || normalizedMessage.includes("comment_permission")
    || normalizedMessage.includes("member_manage_permission");
}

function canWriteBoard(args: {
  board: BoardRecord;
  boardMembershipRole: BoardMembershipRecord["role"] | null;
  membershipRole: MembershipRecord["role"] | null;
  userId: string;
}): boolean {
  if (
    args.board.created_by === args.userId ||
    args.membershipRole === "owner" ||
    args.membershipRole === "admin"
  ) {
    return true;
  }

  if (args.board.visibility === "workspace" && args.membershipRole !== null) {
    return true;
  }

  if (args.board.edit_permission === "admins") {
    return args.boardMembershipRole === "admin";
  }

  return (
    args.boardMembershipRole === "admin" ||
    args.boardMembershipRole === "member"
  );
}

function canReadBoard(args: {
  board: BoardRecord;
  boardMembershipRole: BoardMembershipRecord["role"] | null;
  membershipRole: MembershipRecord["role"] | null;
  userId: string;
}): boolean {
  return (
    args.board.visibility === "public" ||
    (args.board.visibility === "workspace" && args.membershipRole !== null) ||
    args.board.created_by === args.userId ||
    args.membershipRole === "owner" ||
    args.membershipRole === "admin" ||
    args.boardMembershipRole !== null
  );
}

function canManageBoardAccess(args: {
  board: BoardRecord;
  boardMembershipRole: BoardMembershipRecord["role"] | null;
  membershipRole: MembershipRecord["role"] | null;
  userId: string;
}): boolean {
  if (
    args.board.created_by === args.userId ||
    args.membershipRole === "owner" ||
    args.membershipRole === "admin"
  ) {
    return true;
  }

  if (args.board.member_manage_permission === "admins") {
    return args.boardMembershipRole === "admin";
  }

  return (
    args.boardMembershipRole === "admin" ||
    args.boardMembershipRole === "member"
  );
}

function canCommentBoard(args: {
  board: BoardRecord;
  boardMembershipRole: BoardMembershipRecord["role"] | null;
  membershipRole: MembershipRecord["role"] | null;
  userId: string;
}): boolean {
  if (
    args.board.created_by === args.userId ||
    args.membershipRole === "owner" ||
    args.membershipRole === "admin"
  ) {
    return true;
  }

  if (args.board.comment_permission === "admins") {
    return args.boardMembershipRole === "admin";
  }

  if (args.board.visibility === "workspace" && args.membershipRole !== null) {
    return true;
  }

  return (
    args.boardMembershipRole === "admin" ||
    args.boardMembershipRole === "member"
  );
}

function resolveEffectiveRole(args: {
  board: BoardRecord;
  boardMembershipRole: BoardMembershipRecord["role"] | null;
  membershipRole: MembershipRecord["role"] | null;
  userId: string;
}): WorkspaceRole {
  if (args.board.created_by === args.userId || args.membershipRole === "owner") {
    return "owner";
  }

  if (args.membershipRole === "admin" || args.boardMembershipRole === "admin") {
    return "admin";
  }

  if (args.membershipRole === "member" || args.boardMembershipRole === "member") {
    return "member";
  }

  return "viewer";
}

export function computeBoardCapabilities(args: {
  board: BoardRecord;
  boardMembershipRole: BoardMembershipRecord["role"] | null;
  membershipRole: MembershipRecord["role"] | null;
  userId: string;
}) {
  const canRead = canReadBoard(args);
  const canWrite = canWriteBoard(args);
  const canManageSettings =
    args.board.created_by === args.userId ||
    args.membershipRole === "owner" ||
    args.membershipRole === "admin" ||
    args.boardMembershipRole === "admin";

  return {
    canCommentBoard: canCommentBoard(args),
    canManageAccess: canManageBoardAccess(args),
    canManageSettings,
    canReadBoard: canRead,
    canWriteBoard: canWrite,
    isBoardCreator: args.board.created_by === args.userId,
    role: resolveEffectiveRole(args),
  };
}

export function boardRoute(workspaceSlug: string, boardId: string): string {
  return APP_ROUTES.workspace.boardById(workspaceSlug, boardId);
}

export function withBoardError(workspaceSlug: string, boardId: string, message: string): string {
  const searchParams = new URLSearchParams({
    message,
    type: "error",
  });

  return `${boardRoute(workspaceSlug, boardId)}?${searchParams.toString()}`;
}

export function withWorkspaceError(workspaceSlug: string, message: string): string {
  return withWorkspaceMessage(workspaceSlug, message, "error");
}

export function withWorkspaceMessage(
  workspaceSlug: string,
  message: string,
  type: "error" | "success",
): string {
  const baseHref = APP_ROUTES.workspace.boardsBySlug(workspaceSlug);
  const [pathname, existingQuery = ""] = baseHref.split("?", 2);
  const searchParams = new URLSearchParams(existingQuery);
  searchParams.set("message", message);
  searchParams.set("type", type);

  return `${pathname}?${searchParams.toString()}`;
}

export async function resolveBoardAccess(
  workspaceSlug: string,
  boardId: string,
  options: ResolveBoardAccessOptions = {},
): Promise<BoardAccess> {
  const requiredPermission = options.requiredPermission ?? "write";
  const authContext = await getOptionalAuthContext();
  if (!authContext) {
    redirect(APP_ROUTES.login);
  }

  const userId = authContext.userId;
  const supabase = await createServerSupabaseClient();

  const { data: boardWithSettings, error: boardWithSettingsError } = await supabase
    .from("boards")
    .select("id, workspace_id, visibility, created_by, edit_permission, comment_permission, member_manage_permission")
    .eq("id", boardId)
    .is("archived_at", null)
    .maybeSingle();

  if (isMissingBoardSettingsSchema(boardWithSettingsError as SupabaseErrorLike | null)) {
    redirect(withWorkspaceError(
      workspaceSlug,
      "Board settings schema is missing. Run migration 20260222120000_board_settings_permissions.sql.",
    ));
  }

  if (!boardWithSettings) {
    redirect(APP_ROUTES.workspace.boardsBySlug(workspaceSlug));
  }
  const typedBoard = boardWithSettings as BoardRecord;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", typedBoard.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  const typedMembership = (membership as MembershipRecord | null) ?? null;

  const { data: boardMembership } = await supabase
    .from("board_members")
    .select("role")
    .eq("board_id", typedBoard.id)
    .eq("user_id", userId)
    .maybeSingle();
  const typedBoardMembership = (boardMembership as BoardMembershipRecord | null) ?? null;

  if (typedMembership) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", typedBoard.workspace_id)
      .eq("slug", workspaceSlug)
      .maybeSingle();

    if (!workspace) {
      redirect(withWorkspaceError(workspaceSlug, "Workspace not found or inaccessible."));
    }
  }

  const capabilities = computeBoardCapabilities({
    board: typedBoard,
    boardMembershipRole: typedBoardMembership?.role ?? null,
    membershipRole: typedMembership?.role ?? null,
    userId,
  });
  if (!capabilities.canReadBoard) {
    redirect(withWorkspaceError(workspaceSlug, "Board not found or inaccessible."));
  }

  if (requiredPermission === "write" && !capabilities.canWriteBoard) {
    redirect(withBoardError(workspaceSlug, boardId, "This board is read-only for your account."));
  }

  return {
    boardId: typedBoard.id,
    boardMembershipRole: typedBoardMembership?.role ?? null,
    boardCommentPermission: typedBoard.comment_permission,
    boardEditPermission: typedBoard.edit_permission,
    boardMemberManagePermission: typedBoard.member_manage_permission,
    boardVisibility: typedBoard.visibility,
    canCommentBoard: capabilities.canCommentBoard,
    canManageAccess: capabilities.canManageAccess,
    canManageSettings: capabilities.canManageSettings,
    canWriteBoard: capabilities.canWriteBoard,
    isBoardCreator: capabilities.isBoardCreator,
    role: capabilities.role,
    userId,
    workspaceId: typedBoard.workspace_id,
  };
}

export async function logBoardActivity(payload: {
  workspaceId: string;
  boardId: string;
  userId: string;
  entityType: "board" | "list" | "card" | "comment" | "label" | "member";
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServerSupabaseClient();

  await supabase.from("activity_events").insert({
    action: payload.action,
    actor_id: payload.userId,
    board_id: payload.boardId,
    entity_id: payload.entityId,
    entity_type: payload.entityType,
    metadata: payload.metadata ?? {},
    workspace_id: payload.workspaceId,
  });
}

export async function fetchOrderedLists(boardId: string): Promise<ListRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("lists")
    .select("id, title, position")
    .eq("board_id", boardId)
    .is("archived_at", null)
    .order("position", { ascending: true });

  return ((data ?? []) as { id: string; position: number | string; title: string }[]).map((entry) => ({
    id: entry.id,
    position: parseNumeric(entry.position),
    title: entry.title,
  }));
}

export async function fetchCardsForBoard(
  boardId: string,
): Promise<Array<Pick<CardRecord, "id" | "list_id" | "position" | "title">>> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("cards")
    .select("id, list_id, title, position")
    .eq("board_id", boardId)
    .is("archived_at", null)
    .order("position", { ascending: true });

  return ((data ?? []) as {
    id: string;
    list_id: string;
    position: number | string;
    title: string;
  }[]).map((entry) => ({
    id: entry.id,
    list_id: entry.list_id,
    position: parseNumeric(entry.position),
    title: entry.title,
  }));
}
