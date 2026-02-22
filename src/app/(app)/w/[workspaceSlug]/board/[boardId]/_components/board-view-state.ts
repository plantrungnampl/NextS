"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getNextBoardDockState,
  resolveBoardDockState,
  type BoardDockItemKey,
  type BoardDockState,
} from "./board-dock-state";

function areSameDockState(left: BoardDockState, right: BoardDockState): boolean {
  return left.exclusive === right.exclusive && left.inbox === right.inbox && left.info === right.info;
}

function parseDockStateFromCurrentUrl(): BoardDockState {
  const params = new URLSearchParams(window.location.search);
  return resolveBoardDockState({
    viewParam: params.get("view") ?? undefined,
    viewsParam: params.get("views") ?? undefined,
  });
}

function applyDockStateToSearchParams(params: URLSearchParams, state: BoardDockState) {
  params.delete("view");
  params.delete("views");

  if (state.exclusive) {
    params.set("view", state.exclusive);
    return;
  }

  if (state.inbox && state.info) {
    params.set("views", "inbox,info");
    return;
  }

  if (state.inbox) {
    params.set("views", "inbox");
  }
}

function buildUrlWithDockState(state: BoardDockState): string {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  applyDockStateToSearchParams(params, state);

  const queryString = params.toString();
  const pathWithQuery = queryString.length > 0 ? `${url.pathname}?${queryString}` : url.pathname;
  return url.hash.length > 0 ? `${pathWithQuery}${url.hash}` : pathWithQuery;
}

export function useBoardViewState(initialState: BoardDockState) {
  const [state, setState] = useState<BoardDockState>(() => {
    if (typeof window === "undefined") {
      return initialState;
    }

    return parseDockStateFromCurrentUrl();
  });

  useEffect(() => {
    const handlePopState = () => {
      setState(parseDockStateFromCurrentUrl());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const setByDockItem = useCallback((itemKey: BoardDockItemKey) => {
    setState((currentState) => {
      const nextState = getNextBoardDockState({ itemKey, state: currentState });
      if (areSameDockState(currentState, nextState)) {
        return currentState;
      }

      const nextUrl = buildUrlWithDockState(nextState);
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) {
        window.history.pushState(window.history.state, "", nextUrl);
      }

      return nextState;
    });
  }, []);

  return {
    setByDockItem,
    state,
  };
}
