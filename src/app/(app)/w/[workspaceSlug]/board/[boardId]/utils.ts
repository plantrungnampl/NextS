import type { BoardVisibility, CardRecord, ListRecord, ListWithCards, WorkspaceRole } from "./types";

export function parseNumeric(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function positionFromIndex(index: number): number {
  return (index + 1) * 1024;
}

export function nextPositionFromTail(items: { position: number }[]): number {
  if (items.length === 0) {
    return positionFromIndex(0);
  }

  return items[items.length - 1].position + 1024;
}

export function resolveInsertPosition(
  items: Array<{ position: number }>,
  targetOneBasedIndex: number,
): number {
  if (items.length < 1) {
    return positionFromIndex(0);
  }

  const zeroBasedIndex = Math.max(0, Math.min(targetOneBasedIndex - 1, items.length));
  if (zeroBasedIndex >= items.length) {
    return nextPositionFromTail(items);
  }

  if (zeroBasedIndex === 0) {
    const firstPosition = items[0]?.position ?? positionFromIndex(0);
    return firstPosition > 1 ? firstPosition / 2 : firstPosition - 1;
  }

  const previousPosition = items[zeroBasedIndex - 1]?.position ?? positionFromIndex(zeroBasedIndex - 1);
  const nextPosition = items[zeroBasedIndex]?.position ?? previousPosition + 1024;
  if (nextPosition > previousPosition) {
    return previousPosition + (nextPosition - previousPosition) / 2;
  }

  return previousPosition + 0.5;
}

export function canWriteBoardByRole(params: {
  board: { created_by: string; visibility: BoardVisibility };
  role: WorkspaceRole;
  userId: string;
}): boolean {
  if (params.board.visibility === "private") {
    return (
      params.board.created_by === params.userId ||
      params.role === "owner" ||
      params.role === "admin"
    );
  }

  return params.role !== "viewer";
}

export function groupCardsByList(lists: ListRecord[], cards: CardRecord[]): ListWithCards[] {
  return lists.map((list) => ({
    ...list,
    cards: cards.filter((card) => card.list_id === list.id).sort((a, b) => a.position - b.position),
  }));
}
