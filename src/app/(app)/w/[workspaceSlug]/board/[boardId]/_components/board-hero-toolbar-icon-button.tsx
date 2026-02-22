"use client";

import { Rocket, SlidersHorizontal, Star, UsersRound, Zap, type LucideIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { cn } from "@/shared";

type TooltipPlacement = "top" | "bottom";
export type BoardHeroToolbarIconKey = "automation" | "powerUps" | "filters" | "favorite" | "members";

const iconByKey: Record<BoardHeroToolbarIconKey, LucideIcon> = {
  automation: Rocket,
  favorite: Star,
  filters: SlidersHorizontal,
  members: UsersRound,
  powerUps: Zap,
};

const TOOLTIP_SAFE_SPACE = 44;
const CLIPPING_OVERFLOW_VALUES = new Set(["auto", "clip", "hidden", "scroll"]);
export const BOARD_HERO_ICON_BUTTON_BASE_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-200 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70";
export const BOARD_HERO_ICON_TOOLTIP_CLASS =
  "pointer-events-none z-[120] rounded-md border border-white/15 bg-[#0f1420]/95 px-2.5 py-1.5 text-xs font-medium text-slate-100 shadow-lg backdrop-blur-sm";

function findClosestClippingAncestor(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement;

  while (current) {
    const style = window.getComputedStyle(current);
    const hasClipping =
      CLIPPING_OVERFLOW_VALUES.has(style.overflow) ||
      CLIPPING_OVERFLOW_VALUES.has(style.overflowX) ||
      CLIPPING_OVERFLOW_VALUES.has(style.overflowY);

    if (hasClipping) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

export function BoardHeroToolbarIconButton({
  ariaLabel,
  iconKey,
}: {
  ariaLabel: string;
  iconKey: BoardHeroToolbarIconKey;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement>("top");
  const tooltipId = `board-hero-tooltip-${iconKey}`;
  const Icon = iconByKey[iconKey];

  const resolveTooltipPlacement = useCallback(() => {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    let topSpace = rect.top;
    let bottomSpace = window.innerHeight - rect.bottom;
    const clippingAncestor = findClosestClippingAncestor(button);

    if (clippingAncestor) {
      const clippingRect = clippingAncestor.getBoundingClientRect();
      topSpace = Math.min(topSpace, rect.top - clippingRect.top);
      bottomSpace = Math.min(bottomSpace, clippingRect.bottom - rect.bottom);
    }

    setPlacement(topSpace < TOOLTIP_SAFE_SPACE && bottomSpace > topSpace ? "bottom" : "top");
  }, []);

  return (
    <div className="relative inline-flex">
      <button
        aria-describedby={isTooltipOpen ? tooltipId : undefined}
        aria-label={ariaLabel}
        className={BOARD_HERO_ICON_BUTTON_BASE_CLASS}
        onBlur={() => {
          setIsTooltipOpen(false);
        }}
        onFocus={() => {
          resolveTooltipPlacement();
          setIsTooltipOpen(true);
        }}
        onMouseEnter={() => {
          resolveTooltipPlacement();
          setIsTooltipOpen(true);
        }}
        onMouseLeave={() => {
          setIsTooltipOpen(false);
        }}
        ref={buttonRef}
        type="button"
      >
        <Icon className="h-4 w-4" />
      </button>
      {isTooltipOpen ? (
        <div
          className={cn(
            BOARD_HERO_ICON_TOOLTIP_CLASS,
            "absolute left-1/2 max-w-[220px] -translate-x-1/2 whitespace-nowrap",
            placement === "bottom" ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]",
          )}
          id={tooltipId}
          role="tooltip"
        >
          {ariaLabel}
        </div>
      ) : null}
    </div>
  );
}
