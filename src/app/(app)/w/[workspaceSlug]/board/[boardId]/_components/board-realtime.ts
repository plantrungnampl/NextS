"use client";

import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

import type { BoardViewer } from "../types";

const REMOTE_REFRESH_DELAY_MS = 300;
const PRESENCE_COLOR_CLASSES = [
  "bg-sky-800/60 text-sky-100",
  "bg-emerald-800/60 text-emerald-100",
  "bg-violet-800/60 text-violet-100",
  "bg-amber-800/60 text-amber-100",
  "bg-rose-800/60 text-rose-100",
] as const;

type PresenceMetadata = {
  activeCardId?: string | null;
  displayName: string;
  draggingCardId?: string | null;
  draggingListId?: string | null;
  email: string;
  userId: string;
};

export type PresenceUser = PresenceMetadata & {
  activeCardId: string | null;
  colorClass: string;
  draggingCardId: string | null;
  draggingListId: string | null;
};

type ActivityInsertPayload = {
  action: string | null;
  actor_id: string | null;
  board_id: string | null;
  metadata: {
    boardVersionAfter?: number | string;
    mutationId?: string;
  } | null;
};

function presenceColorClass(userId: string): string {
  const hash = Array.from(userId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PRESENCE_COLOR_CLASSES[hash % PRESENCE_COLOR_CLASSES.length];
}

function extractPresenceUsers(channel: RealtimeChannel): PresenceUser[] {
  const state = channel.presenceState<PresenceMetadata>();
  const dedupe = new Map<string, PresenceUser>();

  Object.values(state).forEach((entries) => {
    entries.forEach((entry) => {
      const userId = entry.userId ?? "";
      if (!userId || dedupe.has(userId)) {
        return;
      }

      dedupe.set(userId, {
        activeCardId: entry.activeCardId ?? null,
        colorClass: presenceColorClass(userId),
        displayName: entry.displayName ?? "Teammate",
        draggingCardId: entry.draggingCardId ?? null,
        draggingListId: entry.draggingListId ?? null,
        email: entry.email ?? "",
        userId,
      });
    });
  });

  return Array.from(dedupe.values()).sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

export function useBoardRealtimePresence({
  boardId,
  presencePayload,
  shouldIgnoreMutationId,
  viewer,
  onRemoteActivity,
}: {
  boardId: string;
  onRemoteActivity: (action?: string | null, boardVersionAfter?: number) => void;
  presencePayload?: {
    activeCardId?: string | null;
    draggingCardId?: string | null;
    draggingListId?: string | null;
  };
  shouldIgnoreMutationId?: (mutationId?: string) => boolean;
  viewer: BoardViewer;
}) {
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const presencePayloadRef = useRef(presencePayload);

  useEffect(() => {
    presencePayloadRef.current = presencePayload;
  }, [presencePayload]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(`board-live:${boardId}`, {
      config: {
        presence: { key: viewer.id },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      setPresenceUsers(extractPresenceUsers(channel));
    });

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        filter: `board_id=eq.${boardId}`,
        schema: "public",
        table: "activity_events",
      },
      (payload: RealtimePostgresInsertPayload<ActivityInsertPayload>) => {
        const inserted = payload.new;
        const mutationId = inserted.metadata?.mutationId;
        if (shouldIgnoreMutationId?.(mutationId)) {
          return;
        }

        // Keep self-noise low for events without mutation identity, while still
        // allowing same-user multi-tab updates to propagate via distinct mutationId.
        if (inserted.actor_id && inserted.actor_id === viewer.id && !mutationId) {
          return;
        }

        const boardVersionAfterRaw = inserted.metadata?.boardVersionAfter;
        const boardVersionAfter =
          typeof boardVersionAfterRaw === "number"
            ? boardVersionAfterRaw
            : typeof boardVersionAfterRaw === "string"
              ? Number.parseInt(boardVersionAfterRaw, 10)
              : undefined;

        onRemoteActivity(
          inserted.action,
          Number.isFinite(boardVersionAfter) ? boardVersionAfter : undefined,
        );
      },
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        const currentPresencePayload = presencePayloadRef.current;
        void channel.track({
          activeCardId: currentPresencePayload?.activeCardId ?? null,
          displayName: viewer.displayName,
          draggingCardId: currentPresencePayload?.draggingCardId ?? null,
          draggingListId: currentPresencePayload?.draggingListId ?? null,
          email: viewer.email,
          userId: viewer.id,
        });
      }
    });
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [
    boardId,
    onRemoteActivity,
    shouldIgnoreMutationId,
    viewer.displayName,
    viewer.email,
    viewer.id,
  ]);

  useEffect(() => {
    if (!channelRef.current) {
      return;
    }

    void channelRef.current.track({
      activeCardId: presencePayload?.activeCardId ?? null,
      displayName: viewer.displayName,
      draggingCardId: presencePayload?.draggingCardId ?? null,
      draggingListId: presencePayload?.draggingListId ?? null,
      email: viewer.email,
      userId: viewer.id,
    });
  }, [
    presencePayload?.activeCardId,
    presencePayload?.draggingCardId,
    presencePayload?.draggingListId,
    viewer.displayName,
    viewer.email,
    viewer.id,
  ]);

  return presenceUsers;
}

export function useRemoteBoardRefresh({
  getBoardVersion,
  isDragging,
  syncBoard,
  setBoardVersion,
  setNotice,
}: {
  getBoardVersion: () => number;
  isDragging: boolean;
  syncBoard: () => void;
  setBoardVersion: (nextBoardVersion: number) => void;
  setNotice: (message: string | null) => void;
}) {
  const isDraggingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback(
    (reason?: string | null, boardVersionAfter?: number) => {
      if (refreshTimerRef.current) {
        return;
      }

      if (
        typeof boardVersionAfter === "number" &&
        Number.isFinite(boardVersionAfter) &&
        boardVersionAfter <= getBoardVersion()
      ) {
        return;
      }

      if (typeof boardVersionAfter === "number" && Number.isFinite(boardVersionAfter)) {
        setBoardVersion(boardVersionAfter);
      }

      setNotice(
        reason ? `Teammate update: ${reason}. Syncing...` : "Board updated by teammate. Syncing...",
      );
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        syncBoard();
        setNotice(null);
      }, REMOTE_REFRESH_DELAY_MS);
    },
    [getBoardVersion, setBoardVersion, setNotice, syncBoard],
  );

  useEffect(() => {
    isDraggingRef.current = isDragging;
    if (!isDragging && pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      scheduleRefresh();
    }
  }, [isDragging, scheduleRefresh]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  return useCallback(
    (action?: string | null, boardVersionAfter?: number) => {
      if (isDraggingRef.current) {
        pendingRefreshRef.current = true;
        setNotice("Teammate update detected. Syncing after drag...");
        return;
      }

      scheduleRefresh(action, boardVersionAfter);
    },
    [scheduleRefresh, setNotice],
  );
}
