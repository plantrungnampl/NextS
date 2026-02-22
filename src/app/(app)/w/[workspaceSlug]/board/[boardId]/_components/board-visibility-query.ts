import type { BoardVisibility } from "../types";

export const BOARD_VISIBILITY_QUERY_KEY = "board-visibility";

export type BoardVisibilityClientState = BoardVisibility;

export function buildBoardVisibilityQueryKey(params: {
  boardId: string;
  workspaceSlug: string;
}) {
  return [BOARD_VISIBILITY_QUERY_KEY, params.workspaceSlug, params.boardId] as const;
}
