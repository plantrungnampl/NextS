"use client";
/* eslint-disable max-lines */

import {
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

import { APP_ROUTES } from "@/core";

import type {
  BoardSettings,
  BoardViewer,
  LabelRecord,
  ListWithCards,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "../types";

import {
  applyBoardOptimisticChange,
  type BoardOptimisticChange,
  getOverlayLabel,
  isDragData,
  listDragId,
  type DragData,
} from "./board-dnd-helpers";
import {
  applyBoardFiltersToLists,
  hasActiveBoardFilters,
  parseBoardFilterStateFromSearchParams,
} from "./board-filters";
import { BoardCanvasLayout } from "./board-dnd-canvas-layout";
import { useBoardDropHandlers, type PersistenceResult } from "./board-dnd-mutations";
import { resolveActiveCardId, useBoardCanvasState } from "./board-dnd-canvas-state";
import { useBoardKeyboardShortcuts } from "./board-keyboard-shortcuts";
import { useBoardRealtimePresence, useRemoteBoardRefresh } from "./board-realtime";
import { useBoardVisualSettingsQuery } from "./board-settings-query";
import {
  buildBoardSnapshotQueryKey,
  type BoardSnapshotQueryData,
  useBoardSnapshotQuery,
} from "./board-snapshot-query";
import { useVisibleCardCountByList } from "./board-visible-cards";
import {
  dispatchLocationChangeEvent,
  getLocationSearchSnapshot,
  subscribeToLocationChange,
} from "./board-location-change";

type BoardDndCanvasProps = {
  boardId: string;
  boardName: string;
  canCommentBoard: boolean;
  canWriteBoard: boolean;
  initialBoardSettings: BoardSettings;
  initialBoardVersion: number;
  initialLists: ListWithCards[];
  membershipRole: WorkspaceRole;
  viewer: BoardViewer;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

const LOCAL_MUTATION_TTL_MS = 120000;

function cleanupMutationIds(store: Map<string, number>, nowMs: number): void {
  for (const [mutationId, timestamp] of store.entries()) {
    if (nowMs - timestamp > LOCAL_MUTATION_TTL_MS) {
      store.delete(mutationId);
    }
  }
}

function applyFailureMessage(
  message: string,
  router: ReturnType<typeof useRouter>,
  setNotice: (message: string | null) => void,
) {
  setNotice(message);

  if (message.includes("Refresh and try again.")) {
    router.refresh();
  }
}

function usePersistenceErrorReporter(
  router: ReturnType<typeof useRouter>,
  setNotice: (message: string | null) => void,
) {
  const lastConflictHandledAtRef = useRef(0);

  return useCallback(
    (result: PersistenceResult, fallbackMessage: string) => {
      if (result.code === "CONFLICT") {
        setNotice(null);
        const nowMs = Date.now();
        if (nowMs - lastConflictHandledAtRef.current >= 1500) {
          lastConflictHandledAtRef.current = nowMs;
          toast.warning(result.message ?? "Board state changed while you were dragging. Synced latest board.");
        }
        return;
      }

      const message = result.message ?? fallbackMessage;
      applyFailureMessage(message, router, setNotice);
    },
    [router, setNotice],
  );
}

function useDragEventHandlers({
  handleCardDrop,
  handleListDrop,
  isBoardInteractionLocked,
  setActiveDragData,
}: {
  handleCardDrop: (activeData: DragData, overData: DragData | null) => void;
  handleListDrop: (activeData: DragData, overData: DragData | null) => void;
  isBoardInteractionLocked: boolean;
  setActiveDragData: (value: DragData | null) => void;
}) {
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (isBoardInteractionLocked) {
        setActiveDragData(null);
        return;
      }

      setActiveDragData(isDragData(event.active.data.current) ? event.active.data.current : null);
    },
    [isBoardInteractionLocked, setActiveDragData],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (isBoardInteractionLocked) {
        setActiveDragData(null);
        return;
      }

      const activeData = isDragData(event.active.data.current) ? event.active.data.current : null;
      const overData = isDragData(event.over?.data.current) ? event.over.data.current : null;

      setActiveDragData(null);
      if (!activeData || !overData) {
        return;
      }

      if (activeData.type === "list") {
        handleListDrop(activeData, overData);
      } else {
        handleCardDrop(activeData, overData);
      }
    },
    [handleCardDrop, handleListDrop, isBoardInteractionLocked, setActiveDragData],
  );

  return {
    handleDragEnd,
    handleDragStart,
  };
}

function useBoardInteractionLock({
  activeCardId,
  activeDragData,
  setActiveDragData,
}: {
  activeCardId: string | null;
  activeDragData: DragData | null;
  setActiveDragData: (value: DragData | null) => void;
}) {
  const hasOpenCardModal = Boolean(activeCardId);
  const isBoardInteractionLocked = hasOpenCardModal;

  useEffect(() => {
    if (!isBoardInteractionLocked || !activeDragData) {
      return;
    }

    setActiveDragData(null);
  }, [activeDragData, isBoardInteractionLocked, setActiveDragData]);

  return { hasOpenCardModal, isBoardInteractionLocked };
}

function useSearchShortcutHandler(
  router: ReturnType<typeof useRouter>,
  workspaceSlug: string,
) {
  return useCallback(() => {
    router.push(`${APP_ROUTES.workspace.search}?workspace=${encodeURIComponent(workspaceSlug)}`);
  }, [router, workspaceSlug]);
}

const CARD_QUERY_PARAM = "c";

function parseCardIdFromQuery(searchParams: URLSearchParams): string | null {
  const value = searchParams.get(CARD_QUERY_PARAM);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function useLocationSearchParamsSnapshot() {
  const searchSnapshot = useSyncExternalStore(
    subscribeToLocationChange,
    getLocationSearchSnapshot,
    () => "",
  );
  return useMemo(() => new URLSearchParams(searchSnapshot), [searchSnapshot]);
}

function buildBoardUrlWithCardParam(params: {
  cardId: string | null;
  pathname: string;
  searchParams: URLSearchParams;
}): string {
  const nextParams = new URLSearchParams(params.searchParams.toString());
  if (params.cardId) {
    nextParams.set(CARD_QUERY_PARAM, params.cardId);
  } else {
    nextParams.delete(CARD_QUERY_PARAM);
  }

  const queryString = nextParams.toString();
  return queryString.length > 0 ? `${params.pathname}?${queryString}` : params.pathname;
}

function hasCardIdInLists(lists: ListWithCards[], cardId: string): boolean {
  for (const list of lists) {
    if (list.cards.some((card) => card.id === cardId)) {
      return true;
    }
  }

  return false;
}

// eslint-disable-next-line max-lines-per-function
export function BoardDndCanvas({
  boardId,
  boardName,
  canCommentBoard,
  canWriteBoard,
  initialBoardSettings,
  initialBoardVersion,
  initialLists,
  membershipRole,
  viewer,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: BoardDndCanvasProps) {
  const isReadOnly = !canWriteBoard;
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParamsSnapshot = useLocationSearchParamsSnapshot();
  const boardSnapshotQueryKey = useMemo(
    () =>
      buildBoardSnapshotQueryKey({
        boardId,
        workspaceSlug,
      }),
    [boardId, workspaceSlug],
  );
  const initialBoardSnapshot = useMemo<BoardSnapshotQueryData>(
    () => ({
      boardVersion: initialBoardVersion,
      fetchedAt: new Date(0).toISOString(),
      lists: initialLists,
    }),
    [initialBoardVersion, initialLists],
  );
  const boardSnapshotQuery = useBoardSnapshotQuery({
    boardId,
    initialData: initialBoardSnapshot,
    workspaceSlug,
  });
  const boardSnapshot = boardSnapshotQuery.data ?? initialBoardSnapshot;
  const boardVisualSettingsQuery = useBoardVisualSettingsQuery({
    boardId,
    initialSettings: initialBoardSettings,
    workspaceSlug,
  });
  const boardVisualSettings = boardVisualSettingsQuery.data;
  const lists = boardSnapshot.lists;
  const boardFilterState = useMemo(
    () => parseBoardFilterStateFromSearchParams(searchParamsSnapshot),
    [searchParamsSnapshot],
  );
  const hasActiveFilters = hasActiveBoardFilters(boardFilterState);
  const listsForRender = useMemo(
    () =>
      applyBoardFiltersToLists(lists, boardFilterState, {
        viewerId: viewer.id,
      }),
    [boardFilterState, lists, viewer.id],
  );
  const cardIdFromQuery = parseCardIdFromQuery(searchParamsSnapshot);
  const activeCardId = cardIdFromQuery && hasCardIdInLists(lists, cardIdFromQuery) ? cardIdFromQuery : null;
  const boardVersion = boardSnapshot.boardVersion;
  const {
    activeDragData,
    getExpectedBoardVersion,
    notice,
    rememberMutationId,
    setActiveDragData,
    setBoardVersionSafe,
    setNotice,
    shouldIgnoreMutationId,
  } = useBoardCanvasState({
    cleanupMutationIds,
    initialBoardVersion,
  });
  const latestListsRef = useRef(lists);

  useEffect(() => {
    latestListsRef.current = lists;
  }, [lists]);
  setBoardVersionSafe(boardVersion);

  const updateBoardSnapshotInCache = useCallback(
    (updater: (current: BoardSnapshotQueryData) => BoardSnapshotQueryData) => {
      queryClient.setQueryData<BoardSnapshotQueryData>(
        boardSnapshotQueryKey,
        (current) => updater(current ?? initialBoardSnapshot),
      );
    },
    [boardSnapshotQueryKey, initialBoardSnapshot, queryClient],
  );
  const setListsInCache = useCallback(
    (nextLists: ListWithCards[]) => {
      updateBoardSnapshotInCache((current) => ({
        ...current,
        fetchedAt: new Date().toISOString(),
        lists: nextLists,
      }));
    },
    [updateBoardSnapshotInCache],
  );
  const setBoardVersionInCache = useCallback(
    (nextBoardVersion?: number) => {
      if (typeof nextBoardVersion !== "number" || !Number.isFinite(nextBoardVersion)) {
        return;
      }

      setBoardVersionSafe(nextBoardVersion);
      updateBoardSnapshotInCache((current) => ({
        ...current,
        boardVersion: Math.max(current.boardVersion, nextBoardVersion),
      }));
    },
    [setBoardVersionSafe, updateBoardSnapshotInCache],
  );

  const syncCardQueryParam = useCallback((nextCardId: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    const currentParams = new URLSearchParams(window.location.search);
    const currentValue = currentParams.get(CARD_QUERY_PARAM);
    const currentCardIdInQuery = typeof currentValue === "string" && currentValue.trim().length > 0
      ? currentValue.trim()
      : null;
    if (currentCardIdInQuery === nextCardId) {
      return;
    }

    const nextUrl = buildBoardUrlWithCardParam({
      cardId: nextCardId,
      pathname,
      searchParams: currentParams,
    });
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === nextUrl) {
      return;
    }

    window.history.replaceState(window.history.state, "", nextUrl);
    dispatchLocationChangeEvent();
  }, [pathname]);

  useEffect(() => {
    if (cardIdFromQuery && !activeCardId) {
      syncCardQueryParam(null);
    }
  }, [activeCardId, cardIdFromQuery, syncCardQueryParam]);

  const { hasOpenCardModal, isBoardInteractionLocked } = useBoardInteractionLock({
    activeCardId,
    activeDragData,
    setActiveDragData,
  });
  const isDragInteractionLocked = isBoardInteractionLocked || hasActiveFilters;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const listIds = useMemo(() => listsForRender.map((list) => listDragId(list.id)), [listsForRender]);
  const { loadMoreStep, onLoadMoreCards, visibleCardCountByList } = useVisibleCardCountByList(listsForRender);
  const overlayLabel = getOverlayLabel(activeDragData, listsForRender);
  const filterNotice = hasActiveFilters ? "Đang bật bộ lọc, tắt lọc để kéo thả." : null;
  const presencePayload = useMemo(
    () => ({
      activeCardId,
      draggingCardId: activeDragData?.type === "card" ? activeDragData.cardId : null,
      draggingListId: activeDragData?.type === "list" ? activeDragData.listId : null,
    }),
    [activeCardId, activeDragData],
  );
  const handleCardModalStateChange = useCallback((cardId: string, isOpen: boolean) => {
    const nextActiveCardId = resolveActiveCardId(activeCardId, cardId, isOpen);
    if (nextActiveCardId === activeCardId) {
      return;
    }

    syncCardQueryParam(nextActiveCardId);
  }, [activeCardId, syncCardQueryParam]);
  const onOptimisticBoardChange = useCallback((change: BoardOptimisticChange) => {
    const previousLists = latestListsRef.current;
    const nextLists = applyBoardOptimisticChange(previousLists, change);
    if (nextLists === previousLists) {
      return () => {};
    }

    latestListsRef.current = nextLists;
    setListsInCache(nextLists);
    return () => {
      if (latestListsRef.current !== nextLists) {
        return;
      }

      latestListsRef.current = previousLists;
      setListsInCache(previousLists);
    };
  }, [setListsInCache]);
  const handleCreateList = useCallback((payload: {
    id: string;
    position: number;
    title: string;
  }) => {
    updateBoardSnapshotInCache((current) => {
      if (current.lists.some((list) => list.id === payload.id)) {
        return current;
      }

      const nextLists = [
        ...current.lists,
        {
          cards: [],
          id: payload.id,
          position: payload.position,
          title: payload.title,
        },
      ].sort((left, right) => left.position - right.position);

      return {
        ...current,
        fetchedAt: new Date().toISOString(),
        lists: nextLists,
      };
    });
    setNotice(null);
  }, [setNotice, updateBoardSnapshotInCache]);
  const handleSearchShortcut = useSearchShortcutHandler(router, workspaceSlug);
  const syncBoardFromRemote = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: boardSnapshotQueryKey,
    });
  }, [boardSnapshotQueryKey, queryClient]);
  const onRemoteActivity = useRemoteBoardRefresh({
    getBoardVersion: getExpectedBoardVersion,
    isDragging: Boolean(activeDragData),
    setBoardVersion: setBoardVersionInCache,
    setNotice,
    syncBoard: syncBoardFromRemote,
  });
  const presenceUsers = useBoardRealtimePresence({
    boardId,
    onRemoteActivity,
    presencePayload,
    shouldIgnoreMutationId,
    viewer,
  });
  useBoardKeyboardShortcuts({
    canMutate: !isReadOnly,
    hasOpenCardModal,
    onSearchShortcut: handleSearchShortcut,
  });
  const reportError = usePersistenceErrorReporter(router, setNotice);
  const { handleCardDrop, handleListDrop } = useBoardDropHandlers({
    boardId,
    getExpectedBoardVersion,
    lists,
    rememberMutationId,
    reportError,
    setBoardVersion: setBoardVersionInCache,
    setLists: setListsInCache,
    setNotice,
    workspaceSlug,
  });
  const { handleDragEnd, handleDragStart } = useDragEventHandlers({
    handleCardDrop,
    handleListDrop,
    isBoardInteractionLocked: isDragInteractionLocked,
    setActiveDragData,
  });
  return (
    <BoardCanvasLayout
      boardId={boardId}
      boardName={boardName}
      boardVersion={boardVersion}
      activeCardId={activeCardId}
      canCommentBoard={canCommentBoard}
      handleCardModalStateChange={handleCardModalStateChange}
      handleDragEnd={handleDragEnd}
      handleDragStart={handleDragStart}
      filterNotice={filterNotice}
      isBoardInteractionLocked={isDragInteractionLocked}
      isPointerInteractionLocked={isBoardInteractionLocked}
      isReadOnly={isReadOnly}
      listIds={listIds}
      lists={listsForRender}
      loadMoreStep={loadMoreStep}
      membershipRole={membershipRole}
      notice={notice}
      onCreateList={handleCreateList}
      onOptimisticBoardChange={onOptimisticBoardChange}
      onLoadMoreCards={onLoadMoreCards}
      overlayLabel={overlayLabel}
      presenceUsers={presenceUsers}
      sensors={sensors}
      showCardCoverOnFront={boardVisualSettings.showCardCoverOnFront}
      showCompleteStatusOnFront={boardVisualSettings.showCompleteStatusOnFront}
      viewerId={viewer.id}
      visibleCardCountByList={visibleCardCountByList}
      workspaceLabels={workspaceLabels}
      workspaceMembers={workspaceMembers}
      workspaceSlug={workspaceSlug}
    />
  );
}
