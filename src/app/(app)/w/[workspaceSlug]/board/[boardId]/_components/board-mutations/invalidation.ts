"use client";

import type { QueryClient } from "@tanstack/react-query";

import { cardRichnessKey } from "./keys";

export type CardRichnessScopedKey = readonly [string, string, string, string];

type CardRichnessScope = {
  boardId: string;
  cardId: string;
  richnessQueryKey?: CardRichnessScopedKey;
  workspaceSlug: string;
};

export function resolveCardRichnessQueryKey(params: CardRichnessScope): CardRichnessScopedKey {
  if (params.richnessQueryKey) {
    return params.richnessQueryKey;
  }

  return cardRichnessKey({
    boardId: params.boardId,
    cardId: params.cardId,
    workspaceSlug: params.workspaceSlug,
  });
}

export function cancelCardRichnessQuery(params: CardRichnessScope & {
  queryClient: QueryClient;
}) {
  const queryKey = resolveCardRichnessQueryKey(params);
  void params.queryClient.cancelQueries({ queryKey });
}

export function invalidateCardRichnessQuery(params: CardRichnessScope & {
  queryClient: QueryClient;
}) {
  const queryKey = resolveCardRichnessQueryKey(params);
  void params.queryClient.invalidateQueries({ queryKey });
}
