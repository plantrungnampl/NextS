"use client";

import { buildBoardSnapshotQueryKey } from "../board-snapshot-query";
import { buildCardChecklistQueryKey, buildCardRichnessQueryKey } from "../card-richness-loader";

export function boardSnapshotKey(params: { boardId: string; workspaceSlug: string }) {
  return buildBoardSnapshotQueryKey(params);
}

export function cardRichnessKey(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}) {
  return buildCardRichnessQueryKey(params);
}

export function cardChecklistKey(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}) {
  return buildCardChecklistQueryKey(params);
}
