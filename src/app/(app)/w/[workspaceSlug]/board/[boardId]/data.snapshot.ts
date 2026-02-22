import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase";

import { buildTypedCards } from "./data";
import type { ListWithCards, ListRecord, WorkspaceRole } from "./types";
import { groupCardsByList, parseNumeric } from "./utils";

type BoardSnapshotData = {
  boardVersion: number;
  listsWithCards: ListWithCards[];
};

type BoardSnapshotContextRow = {
  id: string;
  sync_version: number | string;
  visibility: "private" | "public" | "workspace";
  workspace_id: string;
};

export async function getBoardSnapshotData(
  workspaceSlug: string,
  boardId: string,
): Promise<BoardSnapshotData> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const { data: board } = await supabase
    .from("boards")
    .select("id, workspace_id, sync_version, visibility")
    .eq("id", boardId)
    .is("archived_at", null)
    .maybeSingle();
  if (!board) {
    throw new Error("NOT_FOUND");
  }

  const boardContext = board as BoardSnapshotContextRow;
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", boardContext.workspace_id)
    .eq("user_id", user.id);
  const typedMembership = ((membership ?? []) as { role: WorkspaceRole }[])[0] ?? null;
  const canReadBoard = boardContext.visibility === "public" || typedMembership !== null;
  if (!canReadBoard) {
    throw new Error("NOT_FOUND");
  }

  if (typedMembership) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", boardContext.workspace_id)
      .eq("slug", workspaceSlug)
      .maybeSingle();
    if (!workspace) {
      throw new Error("NOT_FOUND");
    }
  }

  const { data: lists } = await supabase
    .from("lists")
    .select("id, title, position")
    .eq("board_id", boardContext.id)
    .is("archived_at", null)
    .order("position", { ascending: true });
  const { data: cards } = await supabase
    .from("cards")
    .select("id, title, list_id, position, description, due_at")
    .eq("board_id", boardContext.id)
    .is("archived_at", null)
    .order("position", { ascending: true });

  const typedLists = ((lists ?? []) as { id: string; position: number | string; title: string }[])
    .map((entry) => ({
      id: entry.id,
      position: parseNumeric(entry.position),
      title: entry.title,
    })) as ListRecord[];
  const rawCards = (cards ?? []) as {
    description: string | null;
    due_at: string | null;
    id: string;
    list_id: string;
    position: number | string;
    title: string;
  }[];
  const typedCards = await buildTypedCards({
    rawCards,
    supabase,
    viewerId: user.id,
    workspaceMembersById: new Map(),
  });

  return {
    boardVersion: parseNumeric(boardContext.sync_version),
    listsWithCards: groupCardsByList(typedLists, typedCards),
  };
}
