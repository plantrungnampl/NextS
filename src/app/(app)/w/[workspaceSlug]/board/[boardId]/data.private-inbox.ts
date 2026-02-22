import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase";

import type { CardRecord } from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type SupabaseQueryErrorLike = {
  code?: string;
  message: string;
};

type PrivateInboxItemRow = {
  card_id: string;
  position: number | string;
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

export async function fetchPrivateInboxCards(params: {
  boardId: string;
  cards: CardRecord[];
  supabase: SupabaseServerClient;
  userId: string;
}): Promise<CardRecord[]> {
  const { data: privateInboxRowsData, error: privateInboxRowsError } = await params.supabase
    .from("board_private_inbox_items")
    .select("card_id, position")
    .eq("board_id", params.boardId)
    .eq("user_id", params.userId)
    .order("position", { ascending: true });
  if (privateInboxRowsError) {
    if (isMissingTableSchemaCacheError(privateInboxRowsError, "board_private_inbox_items")) {
      return [];
    }

    throw new Error(`Failed to load board_private_inbox_items: ${privateInboxRowsError.message}`);
  }

  const privateInboxRows = (privateInboxRowsData ?? []) as PrivateInboxItemRow[];
  const cardsById = new Map(params.cards.map((card) => [card.id, card]));
  return privateInboxRows
    .map((entry) => cardsById.get(entry.card_id))
    .filter((entry): entry is CardRecord => Boolean(entry));
}
