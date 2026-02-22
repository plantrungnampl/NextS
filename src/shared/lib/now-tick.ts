import { useSyncExternalStore } from "react";

const TICK_INTERVAL_MS = 30_000;

let currentNowMs = Date.now();
let timerId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emitTick() {
  currentNowMs = Date.now();
  for (const listener of listeners) {
    listener();
  }
}

function startTicker() {
  if (timerId) {
    return;
  }

  timerId = setInterval(() => {
    emitTick();
  }, TICK_INTERVAL_MS);
}

function stopTicker() {
  if (!timerId) {
    return;
  }

  clearInterval(timerId);
  timerId = null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    startTicker();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopTicker();
    }
  };
}

function getSnapshot() {
  return currentNowMs;
}

function getServerSnapshot() {
  return Date.now();
}

export function useNowTickMs(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
