"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";

import { cn } from "@/shared";

import {
  BOARD_HERO_ICON_BUTTON_BASE_CLASS,
  BOARD_HERO_ICON_TOOLTIP_CLASS,
} from "./board-hero-toolbar-icon-button";
import {
  buildBoardFavoriteQueryKey,
  useBoardFavoriteQuery,
  useToggleBoardFavoriteMutation,
} from "./board-favorite-query";

const FAVORITE_TOOLTIP_CONTENT =
  "Gắn/Bỏ gắn sao bảng.";
const favoriteActiveIconClass = "fill-current text-amber-300";
const favoriteInactiveIconClass = "text-slate-200";
const favoriteActiveSurfaceClass = "bg-white/14 hover:bg-white/18";

export function BoardHeroFavoriteButton({
  boardId,
  initialIsFavorite,
  workspaceSlug,
}: {
  boardId: string;
  initialIsFavorite: boolean;
  workspaceSlug: string;
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const tooltipId = "board-hero-tooltip-favorite";
  const queryClient = useQueryClient();
  const boardFavoriteQueryKey = buildBoardFavoriteQueryKey({ boardId });
  const favoriteQuery = useBoardFavoriteQuery({ boardId, initialIsFavorite });
  const isFavorite = favoriteQuery.data;
  const mutation = useToggleBoardFavoriteMutation({
    boardId,
    initialIsFavorite,
    workspaceSlug,
  });

  const handleToggle = () => {
    if (mutation.isPending) {
      return;
    }

    const cachedFavoriteState = queryClient.getQueryData<boolean>(boardFavoriteQueryKey);
    const currentIsFavorite = typeof cachedFavoriteState === "boolean" ? cachedFavoriteState : initialIsFavorite;
    mutation.mutate(!currentIsFavorite);
  };

  return (
    <div className="relative inline-flex">
      <button
        aria-describedby={isTooltipOpen ? tooltipId : undefined}
        aria-label={isFavorite ? "Bỏ gắn sao bảng" : "Gắn sao bảng"}
        aria-busy={mutation.isPending}
        className={cn(
          BOARD_HERO_ICON_BUTTON_BASE_CLASS,
          isFavorite ? favoriteActiveSurfaceClass : "",
          mutation.isPending ? "cursor-wait opacity-70" : "",
        )}
        disabled={mutation.isPending}
        onBlur={() => {
          setIsTooltipOpen(false);
        }}
        onClick={handleToggle}
        onFocus={() => {
          setIsTooltipOpen(true);
        }}
        onMouseEnter={() => {
          setIsTooltipOpen(true);
        }}
        onMouseLeave={() => {
          setIsTooltipOpen(false);
        }}
        type="button"
      >
        <Star
          className={cn(
            "h-4 w-4 transition-colors",
            isFavorite ? favoriteActiveIconClass : favoriteInactiveIconClass,
          )}
        />
      </button>
      {isTooltipOpen ? (
        <div
          className={cn(
            BOARD_HERO_ICON_TOOLTIP_CLASS,
            "absolute left-1/2 top-[calc(100%+8px)] max-w-[220px] -translate-x-1/2 whitespace-nowrap",
          )}
          id={tooltipId}
          role="tooltip"
        >
          {FAVORITE_TOOLTIP_CONTENT}
        </div>
      ) : null}
    </div>
  );
}
