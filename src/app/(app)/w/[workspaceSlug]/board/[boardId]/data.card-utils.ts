import type { LabelRecord, WorkspaceMemberRecord, WorkspaceRole } from "./types";

export type ProfileRecord = {
  avatar_url: string | null;
  display_name: string;
  id: string;
};

export type CardLabelLinkRow = {
  card_id: string;
  labels?: unknown;
};

export type CardAssigneeLinkRow = {
  card_id: string;
  user_id: string;
};

export type CardCommentLinkRow = {
  card_id: string;
};

export type CardAttachmentLinkRow = {
  card_id: string;
  content_type: string | null;
  id: string;
};

export type CardChecklistLinkRow = {
  card_checklists?: { card_id: string } | Array<{ card_id: string }> | null;
  is_done: boolean;
};

export type CardWatcherLinkRow = {
  card_id: string;
  user_id: string;
};

export function normalizeDisplayName(rawName: string | null | undefined, fallbackId: string): string {
  const trimmed = (rawName ?? "").trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  return `user-${fallbackId.slice(0, 8)}`;
}

function extractNestedLabel(value: unknown): { color: string; id: string; name: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    return extractNestedLabel(value[0]);
  }
  const candidate = value as { color?: unknown; id?: unknown; name?: unknown };
  if (typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.color === "string") {
    return { color: candidate.color, id: candidate.id, name: candidate.name };
  }
  return null;
}

export function toWorkspaceMemberRecord(
  membership: { role: WorkspaceRole; user_id: string },
  profilesById: Map<string, ProfileRecord>,
): WorkspaceMemberRecord {
  const profile = profilesById.get(membership.user_id);
  return {
    avatarUrl: profile?.avatar_url ?? null,
    displayName: normalizeDisplayName(profile?.display_name, membership.user_id),
    id: membership.user_id,
    role: membership.role,
  };
}

export function buildLabelsByCardId(rows: CardLabelLinkRow[]): Map<string, Map<string, LabelRecord>> {
  const labelsByCardId = new Map<string, Map<string, LabelRecord>>();
  for (const entry of rows) {
    const label = extractNestedLabel(entry.labels);
    if (!label) {
      continue;
    }
    const labelsForCard = labelsByCardId.get(entry.card_id) ?? new Map();
    labelsForCard.set(label.id, label);
    labelsByCardId.set(entry.card_id, labelsForCard);
  }
  return labelsByCardId;
}

export function buildAssigneeIdsByCardId(rows: CardAssigneeLinkRow[]): Map<string, string[]> {
  const assigneeIdsByCardId = new Map<string, string[]>();
  for (const entry of rows) {
    const assigneeIds = assigneeIdsByCardId.get(entry.card_id) ?? [];
    if (!assigneeIds.includes(entry.user_id)) {
      assigneeIds.push(entry.user_id);
      assigneeIdsByCardId.set(entry.card_id, assigneeIds);
    }
  }
  return assigneeIdsByCardId;
}

export function buildCountByCardId(rows: CardCommentLinkRow[]): Map<string, number> {
  const countByCardId = new Map<string, number>();
  for (const entry of rows) {
    countByCardId.set(entry.card_id, (countByCardId.get(entry.card_id) ?? 0) + 1);
  }
  return countByCardId;
}

export function buildAttachmentStatsByCardId(rows: CardAttachmentLinkRow[]): {
  attachmentCountByCardId: Map<string, number>;
  coverAttachmentIdByCardId: Map<string, string>;
} {
  const attachmentCountByCardId = new Map<string, number>();
  const coverAttachmentIdByCardId = new Map<string, string>();
  for (const entry of rows) {
    attachmentCountByCardId.set(entry.card_id, (attachmentCountByCardId.get(entry.card_id) ?? 0) + 1);
    if (!coverAttachmentIdByCardId.has(entry.card_id) && entry.content_type?.startsWith("image/")) {
      coverAttachmentIdByCardId.set(entry.card_id, entry.id);
    }
  }
  return { attachmentCountByCardId, coverAttachmentIdByCardId };
}

export function buildChecklistStatsByCardId(rows: CardChecklistLinkRow[]): {
  checklistCompletedCountByCardId: Map<string, number>;
  checklistTotalCountByCardId: Map<string, number>;
} {
  function resolveCardId(entry: CardChecklistLinkRow): string | null {
    if (!entry.card_checklists) {
      return null;
    }

    if (Array.isArray(entry.card_checklists)) {
      return entry.card_checklists[0]?.card_id ?? null;
    }

    return entry.card_checklists.card_id;
  }

  const checklistCompletedCountByCardId = new Map<string, number>();
  const checklistTotalCountByCardId = new Map<string, number>();
  for (const entry of rows) {
    const cardId = resolveCardId(entry);
    if (!cardId) {
      continue;
    }

    checklistTotalCountByCardId.set(cardId, (checklistTotalCountByCardId.get(cardId) ?? 0) + 1);
    if (entry.is_done) {
      checklistCompletedCountByCardId.set(cardId, (checklistCompletedCountByCardId.get(cardId) ?? 0) + 1);
    }
  }
  return { checklistCompletedCountByCardId, checklistTotalCountByCardId };
}

export function buildWatchStatsByCardId(
  rows: CardWatcherLinkRow[],
  viewerId: string,
): {
  watchCountByCardId: Map<string, number>;
  watchedCardIds: Set<string>;
} {
  const watchCountByCardId = new Map<string, number>();
  const watchedCardIds = new Set<string>();
  for (const entry of rows) {
    watchCountByCardId.set(entry.card_id, (watchCountByCardId.get(entry.card_id) ?? 0) + 1);
    if (entry.user_id === viewerId) {
      watchedCardIds.add(entry.card_id);
    }
  }
  return { watchCountByCardId, watchedCardIds };
}
