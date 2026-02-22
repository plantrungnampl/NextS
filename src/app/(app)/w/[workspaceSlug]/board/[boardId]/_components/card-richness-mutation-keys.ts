"use client";

export const CARD_MODAL_MUTATION_KEY = "card-richness-modal-mutation";

export function buildCardModalMutationKey(params: {
  boardId: string;
  cardId: string;
  workspaceSlug: string;
}) {
  return [CARD_MODAL_MUTATION_KEY, params.workspaceSlug, params.boardId, params.cardId] as const;
}
