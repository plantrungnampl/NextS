import { type RefObject } from "react";

import { moveCardIntentDnd, reorderListsDnd } from "../actions.dnd";
import type { ListWithCards } from "../types";

export type PersistenceResult = {
  boardVersion?: number;
  code?: string;
  latestBoardVersion?: number;
  message?: string;
  ok: boolean;
};

type MutationBasePayload = {
  enqueuedAt: number;
  fallbackMessage: string;
  mutationId: string;
  nextLists: ListWithCards[];
  retryCount: number;
  seq: number;
};

export type ReorderListsPayload = MutationBasePayload & {
  orderedListIds: string[];
  type: "list";
};

export type MoveCardIntentPayload = MutationBasePayload & {
  beforeCardId: string | null;
  cardId: string;
  toListId: string;
  type: "card";
};

export type PendingMutationPayload = MoveCardIntentPayload | ReorderListsPayload;
export type PendingCardIntentFlush = Pick<
  MoveCardIntentPayload,
  "beforeCardId" | "cardId" | "mutationId" | "toListId"
>;

type ReorderListsInput = {
  fallbackMessage: string;
  mutationId: string;
  nextLists: ListWithCards[];
  orderedListIds: string[];
  type: "list";
};

type MoveCardIntentInput = {
  beforeCardId: string | null;
  cardId: string;
  fallbackMessage: string;
  mutationId: string;
  nextLists: ListWithCards[];
  toListId: string;
  type: "card";
};

export type PendingMutationInput = MoveCardIntentInput | ReorderListsInput;

export const DND_PERSIST_DEBOUNCE_MS = 180;
const MAX_CARD_CONFLICT_RETRIES = 2;

export function createMutationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function toMutationError(result: PersistenceResult, fallbackMessage: string): Error & { result: PersistenceResult } {
  const error = new Error(result.message ?? fallbackMessage) as Error & { result: PersistenceResult };
  error.result = result;
  return error;
}

export function normalizeMutationFailure(error: unknown, fallbackMessage: string): PersistenceResult {
  if (typeof error === "object" && error !== null && "result" in error) {
    const result = (error as { result?: PersistenceResult }).result;
    if (result && !result.ok) {
      return result;
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return {
      code: "INTERNAL",
      message: error.message,
      ok: false,
    };
  }

  return {
    code: "INTERNAL",
    message: fallbackMessage,
    ok: false,
  };
}

function buildPendingMutationPayload(payload: PendingMutationInput, seq: number): PendingMutationPayload {
  const enqueuedAt = Date.now();
  if (payload.type === "list") {
    return {
      ...payload,
      enqueuedAt,
      retryCount: 0,
      seq,
      type: "list",
    };
  }

  return {
    ...payload,
    beforeCardId: payload.beforeCardId,
    cardId: payload.cardId,
    enqueuedAt,
    retryCount: 0,
    seq,
    toListId: payload.toListId,
    type: "card",
  };
}

function coalescePendingMutations(
  queue: PendingMutationPayload[],
  payload: PendingMutationPayload,
): PendingMutationPayload[] {
  if (payload.type === "list") {
    return [...queue.filter((entry) => entry.type !== "list"), payload];
  }

  return [
    ...queue.filter((entry) => !(entry.type === "card" && entry.cardId === payload.cardId)),
    payload,
  ];
}

export async function executePendingMutationRequest(params: {
  boardId: string;
  expectedBoardVersion: number;
  payload: PendingMutationPayload;
  workspaceSlug: string;
}): Promise<PersistenceResult> {
  if (params.payload.type === "list") {
    return reorderListsDnd({
      boardId: params.boardId,
      expectedBoardVersion: params.expectedBoardVersion,
      mutationId: params.payload.mutationId,
      orderedListIds: params.payload.orderedListIds,
      workspaceSlug: params.workspaceSlug,
    });
  }

  return moveCardIntentDnd({
    beforeCardId: params.payload.beforeCardId,
    boardId: params.boardId,
    cardId: params.payload.cardId,
    expectedBoardVersion: params.expectedBoardVersion,
    mutationId: params.payload.mutationId,
    toListId: params.payload.toListId,
    workspaceSlug: params.workspaceSlug,
  });
}

export function enqueuePendingMutation(params: {
  clearDebounceTimer: () => void;
  debounceTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  flushPendingMutation: () => Promise<void>;
  inFlightRef: RefObject<boolean>;
  latestSeqRef: RefObject<number>;
  payload: PendingMutationInput;
  pendingMutationsRef: RefObject<PendingMutationPayload[]>;
}) {
  const nextSeq = params.latestSeqRef.current + 1;
  params.latestSeqRef.current = nextSeq;

  const nextPayload = buildPendingMutationPayload(params.payload, nextSeq);
  params.pendingMutationsRef.current = coalescePendingMutations(
    params.pendingMutationsRef.current,
    nextPayload,
  );

  params.clearDebounceTimer();
  if (nextPayload.type === "card" && !params.inFlightRef.current) {
    void params.flushPendingMutation();
    return;
  }

  if (params.inFlightRef.current) {
    return;
  }

  params.debounceTimerRef.current = setTimeout(() => {
    params.debounceTimerRef.current = null;
    void params.flushPendingMutation();
  }, DND_PERSIST_DEBOUNCE_MS);
}

export function dequeuePendingMutation(
  pendingMutationsRef: RefObject<PendingMutationPayload[]>,
): PendingMutationPayload | null {
  const queue = pendingMutationsRef.current;
  if (queue.length < 1) {
    return null;
  }

  let nextCardIndex = -1;
  for (let index = 0; index < queue.length; index += 1) {
    const payload = queue[index];
    if (payload.type !== "card") {
      continue;
    }
    if (nextCardIndex < 0 || payload.seq < queue[nextCardIndex].seq) {
      nextCardIndex = index;
    }
  }

  if (nextCardIndex >= 0) {
    const [nextCardPayload] = queue.splice(nextCardIndex, 1);
    return nextCardPayload ?? null;
  }

  let nextIndex = 0;
  for (let index = 1; index < queue.length; index += 1) {
    if (queue[index].seq < queue[nextIndex].seq) {
      nextIndex = index;
    }
  }

  const [nextPayload] = queue.splice(nextIndex, 1);
  return nextPayload ?? null;
}

export function hasPendingMutations(pendingMutationsRef: RefObject<PendingMutationPayload[]>): boolean {
  return pendingMutationsRef.current.length > 0;
}

function toPendingCardIntentFlush(payload: MoveCardIntentPayload): PendingCardIntentFlush {
  return {
    beforeCardId: payload.beforeCardId,
    cardId: payload.cardId,
    mutationId: payload.mutationId,
    toListId: payload.toListId,
  };
}

export function buildCardIntentFlushBatch(params: {
  inFlightPayload: PendingMutationPayload | null;
  pendingMutations: PendingMutationPayload[];
}): PendingCardIntentFlush[] {
  const latestByCardId = new Map<string, MoveCardIntentPayload>();
  const candidates = [...params.pendingMutations];
  if (params.inFlightPayload) {
    candidates.push(params.inFlightPayload);
  }

  for (const payload of candidates) {
    if (payload.type !== "card") {
      continue;
    }
    const current = latestByCardId.get(payload.cardId);
    if (!current || payload.seq > current.seq) {
      latestByCardId.set(payload.cardId, payload);
    }
  }

  return Array.from(latestByCardId.values())
    .sort((left, right) => left.seq - right.seq)
    .map((payload) => toPendingCardIntentFlush(payload));
}

export function enqueueCardConflictRetry(params: {
  latestSeqRef: RefObject<number>;
  payload: PendingMutationPayload;
  pendingMutationsRef: RefObject<PendingMutationPayload[]>;
}): boolean {
  if (params.payload.type !== "card" || params.payload.retryCount >= MAX_CARD_CONFLICT_RETRIES) {
    return false;
  }

  const nextRetryCount = params.payload.retryCount + 1;
  const nextBeforeCardId = nextRetryCount >= 2 ? null : params.payload.beforeCardId;
  const nextSeq = params.latestSeqRef.current + 1;
  params.latestSeqRef.current = nextSeq;

  const retryPayload: MoveCardIntentPayload = {
    ...params.payload,
    beforeCardId: nextBeforeCardId,
    enqueuedAt: Date.now(),
    mutationId: createMutationId(),
    retryCount: nextRetryCount,
    seq: nextSeq,
    type: "card",
  };

  params.pendingMutationsRef.current = coalescePendingMutations(
    params.pendingMutationsRef.current,
    retryPayload,
  );

  return true;
}
