import "server-only";

import { requireAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";

import { buildTypedCards } from "./data";
import type { CardRecord, WorkspaceRole } from "./types";

type BoardContextRow = {
  id: string;
  visibility: "private" | "public" | "workspace";
  workspace_id: string;
};

type PrivateInboxItemRow = {
  card_id: string;
  position: number | string;
};

type SupabaseQueryErrorLike = {
  code?: string;
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

export async function getBoardPrivateInboxData(
  workspaceSlug: string,
  boardId: string,
): Promise<CardRecord[]> {
  const { userId } = await requireAuthContext();
  const supabase = await createServerSupabaseClient();

  const { data: board } = await supabase
    .from("boards")
    .select("id, workspace_id, visibility")
    .eq("id", boardId)
    .is("archived_at", null)
    .maybeSingle();
  if (!board) {
    throw new Error("NOT_FOUND");
  }

  const boardContext = board as BoardContextRow;
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", boardContext.workspace_id)
    .eq("user_id", userId);
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

  const { data: privateInboxRowsData, error: privateInboxRowsError } = await supabase
    .from("board_private_inbox_items")
    .select("card_id, position")
    .eq("board_id", boardContext.id)
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (privateInboxRowsError) {
    if (isMissingTableSchemaCacheError(privateInboxRowsError, "board_private_inbox_items")) {
      return [];
    }

    throw new Error(`Failed to load board_private_inbox_items: ${privateInboxRowsError.message}`);
  }

  const privateInboxRows = (privateInboxRowsData ?? []) as PrivateInboxItemRow[];
  if (privateInboxRows.length < 1) {
    return [];
  }

  const orderedCardIds = privateInboxRows.map((entry) => entry.card_id);
  const uniqueCardIds = Array.from(new Set(orderedCardIds));

  const { data: cards } = await supabase
    .from("cards")
    .select("id, title, list_id, position, description, due_at, updated_at")
    .eq("board_id", boardContext.id)
    .in("id", uniqueCardIds)
    .is("archived_at", null)
    .order("position", { ascending: true });

  const rawCards = (cards ?? []) as Array<{
    description: string | null;
    due_at: string | null;
    id: string;
    list_id: string;
    position: number | string;
    title: string;
    updated_at: string | null;
  }>;

  const typedCards = await buildTypedCards({
    rawCards,
    supabase,
    viewerId: userId,
    workspaceMembersById: new Map(),
  });
  const cardsById = new Map(typedCards.map((card) => [card.id, card]));

  return orderedCardIds
    .map((cardId) => cardsById.get(cardId))
    .filter((card): card is CardRecord => Boolean(card));
}
