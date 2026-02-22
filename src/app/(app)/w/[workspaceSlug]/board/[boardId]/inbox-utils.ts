export const INBOX_LIST_DISPLAY_NAME = "Hộp thư đến";

function normalizeInboxTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isInboxListTitle(title: string): boolean {
  const normalizedTitle = normalizeInboxTitle(title);
  return normalizedTitle === "hop thu den" || normalizedTitle === "inbox";
}

export function resolveInboxListId<T extends { id: string; title: string }>(
  listOptions: T[],
): string | null {
  const matchedList = listOptions.find((listOption) => isInboxListTitle(listOption.title));
  return matchedList?.id ?? null;
}
