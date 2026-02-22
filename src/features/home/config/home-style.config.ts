import { APP_ROUTES } from "@/core";

import type { UiStyle } from "../types";

export const HOME_STYLE_QUERY_KEY = "style" as const;
export const HOME_DEFAULT_STYLE: UiStyle = "enterprise";
export const HOME_SUPPORTED_STYLES = ["enterprise", "playful"] as const satisfies readonly UiStyle[];

const HOME_STYLE_SET = new Set<UiStyle>(HOME_SUPPORTED_STYLES);

export function isSupportedHomeStyle(value: string): value is UiStyle {
  return HOME_STYLE_SET.has(value as UiStyle);
}

export function buildHomeStyleHref(style: UiStyle): string {
  return `${APP_ROUTES.home}?${HOME_STYLE_QUERY_KEY}=${style}`;
}
