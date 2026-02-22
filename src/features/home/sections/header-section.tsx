import { APP_ROUTES } from "@/core";

import { navLinks } from "../data/home-content";
import { BrandMark, ButtonLink, StyleSwitch } from "../components";
import type { UiStyle, UiTheme } from "../types";

type HeaderSectionProps = {
  theme: UiTheme;
  currentStyle: UiStyle;
};

export function HeaderSection({ theme, currentStyle }: HeaderSectionProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/65 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 md:px-10">
        <BrandMark theme={theme} />
        <StyleSwitch currentStyle={currentStyle} theme={theme} />
        <nav aria-label="Primary" className="hidden items-center gap-2 lg:flex">
          {navLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition duration-200 cursor-pointer ${theme.focusRingClass} ${theme.navIdleClass}`}
            >
              {item.label}
            </a>
          ))}
          <ButtonLink href={APP_ROUTES.login} theme={theme}>
            Start free
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
