"use client";

import type { ReactNode } from "react";

import {
  isBoardDockItemActive,
  type BoardDockItemKey,
  type BoardDockState,
} from "./board-dock-state";

type DockItem = {
  icon: ReactNode;
  key: BoardDockItemKey;
  label: string;
};

function DockIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-4 w-4 items-center justify-center text-current"
    >
      {children}
    </span>
  );
}

const dockItems: DockItem[] = [
  {
    icon: (
      <DockIcon>
        <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
          <path d="M3 6h18v12H3z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M7 10h10" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </DockIcon>
    ),
    key: "inbox",
    label: "Hộp thư đến",
  },
  {
    icon: (
      <DockIcon>
        <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
          <rect height="16" rx="2" stroke="currentColor" strokeWidth="1.8" width="16" x="4" y="5" />
          <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </DockIcon>
    ),
    key: "planner",
    label: "Trình lập kế hoạch",
  },
  {
    icon: (
      <DockIcon>
        <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
          <rect height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5" />
          <path d="M9 5v14M15 5v14" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </DockIcon>
    ),
    key: "info",
    label: "Bảng thông tin",
  },
  {
    icon: (
      <DockIcon>
        <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
          <path d="M7 7h10M7 12h10M7 17h10" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 7l2-2M20 17l-2 2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </DockIcon>
    ),
    key: "switcher",
    label: "Chuyển đổi các bảng",
  },
];

export function BoardBottomDock({
  onSelect,
  state,
}: {
  onSelect: (itemKey: BoardDockItemKey) => void;
  state: BoardDockState;
}) {
  return (
    <nav
      aria-label="Board bottom navigation"
      className="pointer-events-none fixed bottom-2 left-1/2 z-40 hidden -translate-x-1/2 md:block"
    >
      <ul className="pointer-events-auto flex items-center gap-1 rounded-xl border border-black/45 bg-[#171a21]/95 p-1 shadow-2xl shadow-black/45 backdrop-blur">
        {dockItems.map((item) => {
          const itemActive = isBoardDockItemActive({ itemKey: item.key, state });

          return (
            <li className="group relative" key={item.label}>
              <button
                aria-label={item.label}
                aria-pressed={itemActive}
                className={
                  itemActive
                    ? "inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0b5fc6] px-3 text-sm font-medium text-white"
                    : "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                }
                onClick={() => {
                  onSelect(item.key);
                }}
                title={item.label}
                type="button"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
              <span
                className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-[#0f1420]/95 px-2 py-1 text-xs font-medium text-slate-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                role="tooltip"
              >
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
