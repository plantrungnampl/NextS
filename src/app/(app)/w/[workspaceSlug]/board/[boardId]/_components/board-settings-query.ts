"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { updateBoardSettingsInline } from "../actions.board-settings.inline";
import type { BoardSettings } from "../types";

export const BOARD_SETTINGS_QUERY_KEY = "board-settings";
const SETTINGS_AUTOSAVE_DEBOUNCE_MS = 300;
const SETTINGS_SAVED_STATUS_MS = 1800;

export type BoardSettingsClientState = BoardSettings;
export type BoardVisualSettingsClientState = Pick<
  BoardSettingsClientState,
  "showCardCoverOnFront" | "showCompleteStatusOnFront"
>;
export type BoardSettingsSaveStatus = "idle" | "saving" | "saved" | "error";
type BoardSettingsKey = keyof BoardSettingsClientState;
type BoardSettingsPatch = Partial<BoardSettingsClientState>;
type KeysBySeq = Partial<Record<BoardSettingsKey, number>>;

export function buildBoardSettingsQueryKey(params: {
  boardId: string;
  workspaceSlug: string;
}) {
  return [BOARD_SETTINGS_QUERY_KEY, params.workspaceSlug, params.boardId] as const;
}

const pickBoardVisualSettings = (
  settings: BoardSettingsClientState,
): BoardVisualSettingsClientState => ({
  showCardCoverOnFront: settings.showCardCoverOnFront,
  showCompleteStatusOnFront: settings.showCompleteStatusOnFront,
});

function isBoardSettingsKey(key: string): key is BoardSettingsKey {
  return key in {
    commentPermission: true,
    editPermission: true,
    memberManagePermission: true,
    showCardCoverOnFront: true,
    showCompleteStatusOnFront: true,
  };
}

export function useBoardSettingsQuery<TSelected = BoardSettingsClientState>(params: {
  boardId: string;
  initialSettings: BoardSettingsClientState;
  select?: (settings: BoardSettingsClientState) => TSelected;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = buildBoardSettingsQueryKey({
    boardId: params.boardId,
    workspaceSlug: params.workspaceSlug,
  });

  return useQuery({
    initialData: params.initialSettings,
    queryFn: () => {
      const cachedSettings = queryClient.getQueryData<BoardSettingsClientState>(queryKey);
      return cachedSettings ?? params.initialSettings;
    },
    queryKey,
    select: params.select,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useBoardVisualSettingsQuery(params: {
  boardId: string;
  initialSettings: BoardSettingsClientState;
  workspaceSlug: string;
}) {
  return useBoardSettingsQuery({
    ...params,
    select: pickBoardVisualSettings,
  });
}

// eslint-disable-next-line max-lines-per-function
export function useUpdateBoardSettingsMutation(params: {
  boardId: string;
  initialSettings: BoardSettingsClientState;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = buildBoardSettingsQueryKey({
    boardId: params.boardId,
    workspaceSlug: params.workspaceSlug,
  });

  const [lastError, setLastError] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState<BoardSettingsKey[]>([]);
  const [saveStatus, setSaveStatus] = useState<BoardSettingsSaveStatus>("idle");

  const dirtyKeysRef = useRef<Set<BoardSettingsKey>>(new Set<BoardSettingsKey>());
  const keyLastEditSeqRef = useRef<KeysBySeq>({});
  const keyBaseValueRef = useRef<Partial<BoardSettingsClientState>>({});
  const latestEditSeqRef = useRef(0);
  const inFlightPatchRef = useRef<BoardSettingsPatch | null>(null);
  const inFlightSeqRef = useRef<KeysBySeq>({});
  const queuedPatchRef = useRef<BoardSettingsPatch>({});
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushNowRef = useRef<(() => Promise<void>) | null>(null);

  const updatePendingKeysState = useCallback(() => {
    const nextPendingKeys = Array.from(dirtyKeysRef.current).sort();
    setPendingKeys(nextPendingKeys);
  }, []);

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, []);

  const markSavedThenIdle = useCallback(() => {
    clearSavedTimer();
    setSaveStatus("saved");
    savedTimerRef.current = setTimeout(() => {
      setSaveStatus((previous) => (previous === "saved" ? "idle" : previous));
      savedTimerRef.current = null;
    }, SETTINGS_SAVED_STATUS_MS);
  }, [clearSavedTimer]);

  const hasQueuedPatch = useCallback(
    () => Object.keys(queuedPatchRef.current).length > 0,
    [],
  );

  const applyPatchToCache = useCallback((patch: BoardSettingsPatch) => {
    if (Object.keys(patch).length < 1) {
      return;
    }

    queryClient.setQueryData<BoardSettingsClientState>(queryKey, (current) => {
      const base = current ?? params.initialSettings;
      return {
        ...base,
        ...patch,
      };
    });
  }, [params.initialSettings, queryClient, queryKey]);

  const settleStatusFromRefs = useCallback(() => {
    if (inFlightPatchRef.current || hasQueuedPatch()) {
      setSaveStatus("saving");
      return;
    }

    if (dirtyKeysRef.current.size > 0) {
      setSaveStatus("error");
      return;
    }

    markSavedThenIdle();
  }, [hasQueuedPatch, markSavedThenIdle]);

  const flushNow = useCallback(async () => {
    if (inFlightPatchRef.current) {
      return;
    }

    const queuedPatch = queuedPatchRef.current;
    const requestEntries = Object.entries(queuedPatch).filter(([key]) => isBoardSettingsKey(key));
    if (requestEntries.length < 1) {
      settleStatusFromRefs();
      return;
    }

    const requestPatch = Object.fromEntries(requestEntries) as BoardSettingsPatch;
    queuedPatchRef.current = {};
    inFlightPatchRef.current = requestPatch;
    inFlightSeqRef.current = {};
    for (const [key] of requestEntries) {
      const typedKey = key as BoardSettingsKey;
      inFlightSeqRef.current[typedKey] = keyLastEditSeqRef.current[typedKey] ?? 0;
    }

    setSaveStatus("saving");
    setLastError(null);

    const result = await updateBoardSettingsInline({
      boardId: params.boardId,
      patch: requestPatch,
      workspaceSlug: params.workspaceSlug,
    });

    const requestKeys = Object.keys(requestPatch).filter(isBoardSettingsKey);

    if (!result.ok) {
      setLastError(result.error ?? "Không thể cập nhật cài đặt bảng.");
      toast.error(result.error ?? "Không thể cập nhật cài đặt bảng.");

      const rollbackPatch: BoardSettingsPatch = {};
      for (const key of requestKeys) {
        const requestKeySeq = inFlightSeqRef.current[key] ?? 0;
        const currentKeySeq = keyLastEditSeqRef.current[key] ?? 0;
        if (currentKeySeq !== requestKeySeq) {
          continue;
        }

        const rollbackValue = keyBaseValueRef.current[key];
        if (rollbackValue !== undefined) {
          (
            rollbackPatch as Record<BoardSettingsKey, BoardSettingsClientState[BoardSettingsKey]>
          )[key] = rollbackValue as BoardSettingsClientState[typeof key];
        }

        dirtyKeysRef.current.delete(key);
        delete keyBaseValueRef.current[key];
      }

      applyPatchToCache(rollbackPatch);
      updatePendingKeysState();

      inFlightPatchRef.current = null;
      inFlightSeqRef.current = {};
      settleStatusFromRefs();

      if (hasQueuedPatch()) {
        void flushNowRef.current?.();
      }
      return;
    }

    const currentSettings =
      queryClient.getQueryData<BoardSettingsClientState>(queryKey) ?? params.initialSettings;
    const mergedSettings: BoardSettingsClientState = { ...currentSettings };
    for (const key of requestKeys) {
      const requestKeySeq = inFlightSeqRef.current[key] ?? 0;
      const currentKeySeq = keyLastEditSeqRef.current[key] ?? 0;
      if (currentKeySeq !== requestKeySeq) {
        continue;
      }

      (
        mergedSettings as Record<BoardSettingsKey, BoardSettingsClientState[BoardSettingsKey]>
      )[key] = result.settings[key];
      dirtyKeysRef.current.delete(key);
      delete keyBaseValueRef.current[key];
    }

    queryClient.setQueryData(queryKey, mergedSettings);
    updatePendingKeysState();

    inFlightPatchRef.current = null;
    inFlightSeqRef.current = {};
    settleStatusFromRefs();

    if (hasQueuedPatch()) {
      void flushNowRef.current?.();
    }
  }, [
    applyPatchToCache,
    hasQueuedPatch,
    params.boardId,
    params.initialSettings,
    params.workspaceSlug,
    queryClient,
    queryKey,
    settleStatusFromRefs,
    updatePendingKeysState,
  ]);
  useEffect(() => {
    flushNowRef.current = flushNow;
  }, [flushNow]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      void flushNow();
    }, SETTINGS_AUTOSAVE_DEBOUNCE_MS);
  }, [flushNow]);

  const applyOptimisticPatch = useCallback((patch: BoardSettingsPatch) => {
    const patchEntries = Object.entries(patch).filter(([key]) => isBoardSettingsKey(key));
    if (patchEntries.length < 1) {
      return;
    }

    clearSavedTimer();
    setLastError(null);
    setSaveStatus("saving");

    const currentSettings =
      queryClient.getQueryData<BoardSettingsClientState>(queryKey) ?? params.initialSettings;
    for (const [key, value] of patchEntries) {
      const typedKey = key as BoardSettingsKey;
      if (!dirtyKeysRef.current.has(typedKey)) {
        (
          keyBaseValueRef.current as Record<
            BoardSettingsKey,
            BoardSettingsClientState[BoardSettingsKey] | undefined
          >
        )[typedKey] = currentSettings[typedKey];
      }
      dirtyKeysRef.current.add(typedKey);
      latestEditSeqRef.current += 1;
      keyLastEditSeqRef.current[typedKey] = latestEditSeqRef.current;
      (
        queuedPatchRef.current as Record<
          BoardSettingsKey,
          BoardSettingsClientState[BoardSettingsKey] | undefined
        >
      )[typedKey] = value as BoardSettingsClientState[typeof typedKey];
    }

    applyPatchToCache(Object.fromEntries(patchEntries) as BoardSettingsPatch);
    updatePendingKeysState();
    scheduleFlush();
  }, [
    applyPatchToCache,
    clearSavedTimer,
    params.initialSettings,
    queryClient,
    queryKey,
    scheduleFlush,
    updatePendingKeysState,
  ]);

  useEffect(() => () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
    }
  }, []);

  return {
    applyOptimisticPatch,
    flushNow,
    isPending: saveStatus === "saving",
    lastError,
    mutate: applyOptimisticPatch,
    pendingKeys,
    saveStatus,
    settingsQueryKey: queryKey,
  };
}
