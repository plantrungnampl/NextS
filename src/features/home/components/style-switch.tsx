import Link from "next/link";

import { buildHomeStyleHref } from "../config";
import type { UiStyle, UiTheme } from "../types";

type StyleSwitchProps = {
  currentStyle: UiStyle;
  theme: UiTheme;
};

export function StyleSwitch({ currentStyle, theme }: StyleSwitchProps) {
  return (
    <div className={`flex rounded-2xl p-1 ${theme.styleSwitchClass}`}>
      <Link
        href={buildHomeStyleHref("enterprise")}
        aria-current={currentStyle === "enterprise" ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition duration-200 cursor-pointer ${theme.focusRingClass} ${
          currentStyle === "enterprise" ? theme.navActiveClass : theme.navIdleClass
        }`}
      >
        Enterprise
      </Link>
      <Link
        href={buildHomeStyleHref("playful")}
        aria-current={currentStyle === "playful" ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition duration-200 cursor-pointer ${theme.focusRingClass} ${
          currentStyle === "playful" ? theme.navActiveClass : theme.navIdleClass
        }`}
      >
        Playful
      </Link>
    </div>
  );
}
