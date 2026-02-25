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

function toPresenceTrackPayload(
  viewer: BoardViewer,
  presencePayload?: {
    activeCardId?: string | null;
    draggingCardId?: string | null;
    draggingListId?: string | null;
  },
) {
  return {
    activeCardId: presencePayload?.activeCardId ?? null,
    displayName: viewer.displayName,
    draggingCardId: presencePayload?.draggingCardId ?? null,
    draggingListId: presencePayload?.draggingListId ?? null,
    email: viewer.email,
    userId: viewer.id,
  };
}

function subscribeBoardActivity(params: {
  boardId: string;
  channel: RealtimeChannel;
  onRemoteActivity: (action?: string | null, boardVersionAfter?: number) => void;
  shouldIgnoreMutationId?: (mutationId?: string) => boolean;
  viewerId: string;
}) {
  params.channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      filter: `board_id=eq.${params.boardId}`,
      schema: "public",
      table: "activity_events",
    },
    (payload: RealtimePostgresInsertPayload<ActivityInsertPayload>) => {
      const inserted = payload.new;
      const mutationId = inserted.metadata?.mutationId;
      if (params.shouldIgnoreMutationId?.(mutationId)) {
        return;
      }

      if (inserted.actor_id && inserted.actor_id === params.viewerId && !mutationId) {
        return;
      }

      const boardVersionAfterRaw = inserted.metadata?.boardVersionAfter;
      const boardVersionAfter =
        typeof boardVersionAfterRaw === "number"
          ? boardVersionAfterRaw
          : typeof boardVersionAfterRaw === "string"
            ? Number.parseInt(boardVersionAfterRaw, 10)
            : undefined;

      params.onRemoteActivity(
        inserted.action,
        Number.isFinite(boardVersionAfter) ? boardVersionAfter : undefined,
      );
    },
  );
}

async function createBoardRealtimeChannel(params: {
  boardId: string;
  onRemoteActivity: (action?: string | null, boardVersionAfter?: number) => void;
  presencePayload?: {
    activeCardId?: string | null;
    draggingCardId?: string | null;
    draggingListId?: string | null;
  };
  setPresenceUsers: (users: PresenceUser[]) => void;
  shouldIgnoreMutationId?: (mutationId?: string) => boolean;
  supabase: ReturnType<typeof createBrowserSupabaseClient>;
  viewer: BoardViewer;
}): Promise<RealtimeChannel> {
  try {
    const response = await fetch("/api/auth/supabase-token", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { token?: string };
      if (payload.token) {
        params.supabase.realtime.setAuth(payload.token);
      }
    }
  } catch {
    // Keep channel setup resilient in case token endpoint is temporarily unavailable.
  }

  const channel = params.supabase.channel(`board-live:${params.boardId}`, {
    config: {
      presence: { key: params.viewer.id },
    },
  });

  channel.on("presence", { event: "sync" }, () => {
    params.setPresenceUsers(extractPresenceUsers(channel));
  });

  subscribeBoardActivity({
    boardId: params.boardId,
    channel,
    onRemoteActivity: params.onRemoteActivity,
    shouldIgnoreMutationId: params.shouldIgnoreMutationId,
    viewerId: params.viewer.id,
  });

  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") {
      return;
    }

    void channel.track(toPresenceTrackPayload(params.viewer, params.presencePayload));
  });

  return channel;
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
    let cancelled = false;

    const connect = async () => {
      const channel = await createBoardRealtimeChannel({
        boardId,
        onRemoteActivity,
        presencePayload: presencePayloadRef.current,
        setPresenceUsers,
        shouldIgnoreMutationId,
        supabase,
        viewer,
      });

      if (cancelled) {
        void channel.untrack();
        void supabase.removeChannel(channel);
        return;
      }
      channelRef.current = channel;
    };

    void connect();

    return () => {
      cancelled = true;
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) {
        void channel.untrack();
        void supabase.removeChannel(channel);
      }
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

    void channelRef.current.track(toPresenceTrackPayload(viewer, presencePayload));
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
