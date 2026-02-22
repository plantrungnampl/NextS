import { APP_ROUTES } from "@/core";

import { boardColumns } from "../data/home-content";
import { BoardColumnPanel, ButtonLink } from "../components";
import type { UiTheme } from "../types";

type HeroSectionProps = {
  theme: UiTheme;
};

export function HeroSection({ theme }: HeroSectionProps) {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-14 pt-10 md:grid-cols-[1.05fr_1fr] md:items-center md:px-10">
      <div className="motion-rise">
        <p
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${theme.badgeClass}`}
        >
          {theme.name} UI Variant
        </p>
        <h1
          className={`mt-5 text-4xl font-black leading-tight tracking-tight md:text-6xl ${theme.heroTitleClass}`}
        >
          Trello-style planning, rebuilt for teams shipping at real scale.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 md:text-lg">
          NexaBoard combines visual planning, automation, and governance so every
          product squad moves faster without losing control of delivery quality.
        </p>
        <div id="start" className="mt-8 flex flex-wrap gap-3">
          <ButtonLink
            href={APP_ROUTES.login}
            theme={theme}
            ariaLabel="Start with NexaBoard login"
          >
            Create your workspace
          </ButtonLink>
          <ButtonLink href="#features" variant="secondary" theme={theme}>
            Explore capabilities
          </ButtonLink>
        </div>
      </div>
      <div className={`motion-rise rounded-[28px] p-4 md:p-5 ${theme.heroPanelClass}`}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Live Board Snapshot • Product Delivery
          </p>
          <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">
            24 active cards
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {boardColumns.map((column, index) => (
            <BoardColumnPanel
              key={column.title}
              column={column}
              toneClass={theme.boardToneClasses[index]}
              theme={theme}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
