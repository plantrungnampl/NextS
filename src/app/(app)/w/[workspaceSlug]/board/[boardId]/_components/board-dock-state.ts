export type BoardToggleView = "inbox" | "info";
export type BoardExclusiveView = "planner" | "switcher" | null;
export type BoardDockState = {
  exclusive: BoardExclusiveView;
  inbox: boolean;
  info: boolean;
};

export type BoardDockItemKey = BoardToggleView | Exclude<BoardExclusiveView, null>;

function parseToggleViews(viewsParam?: string): {
  hasAny: boolean;
  info: boolean;
  inbox: boolean;
} {
  if (!viewsParam || viewsParam.trim().length < 1) {
    return { hasAny: false, info: false, inbox: false };
  }

  const values = viewsParam
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry === "inbox" || entry === "info");

  return {
    hasAny: values.length > 0,
    info: values.includes("info"),
    inbox: values.includes("inbox"),
  };
}

export function resolveBoardDockState(params: {
  viewParam?: string;
  viewsParam?: string;
}): BoardDockState {
  if (params.viewParam === "planner" || params.viewParam === "switcher") {
    return { exclusive: params.viewParam, info: false, inbox: false };
  }

  const parsedToggleViews = parseToggleViews(params.viewsParam);
  if (parsedToggleViews.hasAny) {
    return {
      exclusive: null,
      info: parsedToggleViews.info,
      inbox: parsedToggleViews.inbox,
    };
  }

  if (params.viewParam === "inbox") {
    return {
      exclusive: null,
      info: true,
      inbox: true,
    };
  }

  return {
    exclusive: null,
    info: true,
    inbox: false,
  };
}

function normalizeToggleBaseState(state: BoardDockState): Pick<BoardDockState, "inbox" | "info"> {
  if (state.exclusive) {
    return { info: true, inbox: false };
  }

  return {
    info: state.info,
    inbox: state.inbox,
  };
}

function normalizeSafeToggleState(state: Pick<BoardDockState, "inbox" | "info">): Pick<BoardDockState, "inbox" | "info"> {
  if (state.inbox || state.info) {
    return state;
  }

  return { info: true, inbox: false };
}

function buildViewsParam(toggleState: Pick<BoardDockState, "inbox" | "info">): string | null {
  const views: BoardToggleView[] = [];
  if (toggleState.inbox) {
    views.push("inbox");
  }
  if (toggleState.info) {
    views.push("info");
  }

  return views.length > 0 ? views.join(",") : null;
}

export function getNextBoardDockState(params: {
  itemKey: BoardDockItemKey;
  state: BoardDockState;
}): BoardDockState {
  if (params.itemKey === "planner" || params.itemKey === "switcher") {
    return {
      exclusive: params.itemKey,
      info: false,
      inbox: false,
    };
  }

  const baseToggleState = normalizeToggleBaseState(params.state);
  const toggledState = params.itemKey === "inbox"
    ? { ...baseToggleState, inbox: !baseToggleState.inbox }
    : { ...baseToggleState, info: !baseToggleState.info };
  const safeState = normalizeSafeToggleState(toggledState);

  return {
    exclusive: null,
    info: safeState.info,
    inbox: safeState.inbox,
  };
}

export function buildBoardDockHref(params: {
  boardPath: string;
  itemKey: BoardDockItemKey;
  state: BoardDockState;
}): string {
  const nextState = getNextBoardDockState({
    itemKey: params.itemKey,
    state: params.state,
  });

  if (nextState.exclusive) {
    return `${params.boardPath}?view=${nextState.exclusive}`;
  }

  if (!nextState.inbox && nextState.info) {
    return params.boardPath;
  }

  const viewsParam = buildViewsParam({ inbox: nextState.inbox, info: nextState.info });
  return viewsParam ? `${params.boardPath}?views=${viewsParam}` : params.boardPath;
}

export function isBoardDockItemActive(params: {
  itemKey: BoardDockItemKey;
  state: BoardDockState;
}): boolean {
  if (params.itemKey === "planner" || params.itemKey === "switcher") {
    return params.state.exclusive === params.itemKey;
  }

  if (params.state.exclusive) {
    return false;
  }

  return params.itemKey === "inbox" ? params.state.inbox : params.state.info;
}
