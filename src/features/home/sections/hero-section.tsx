import { PlayCircle } from "lucide-react";

import { ButtonLink, KanbanPreview } from "../components";
import type { HomeContent } from "../data/home-content";

type HeroSectionProps = {
  content: HomeContent;
};

export function HeroSection({ content }: HeroSectionProps) {
  const [primaryCta, secondaryCta] = content.hero.ctas;

  return (
    <section className="mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-[1200px] items-center gap-12 px-6 pb-12 pt-10 lg:grid-cols-2 lg:gap-10 lg:pb-16 lg:pt-14">
      <div className="home-reveal">
        <p className="inline-flex rounded-full border border-[#CCE6F4] bg-[#EAF4FB] px-4 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-[#005A8C]">
          {content.hero.badge}
        </p>
        <h1 className="mt-6 max-w-[620px] text-balance text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-[var(--home-text-primary)] md:text-[4.5rem] md:leading-[1.05]">
          {content.hero.title}
        </h1>
        <p className="mt-5 max-w-[560px] text-lg leading-8 text-[var(--home-text-secondary)] md:text-xl">
          {content.hero.description}
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <ButtonLink
            href={primaryCta.href}
            variant={primaryCta.variant}
            ariaLabel={primaryCta.ariaLabel}
          >
            {primaryCta.label}
          </ButtonLink>
          <ButtonLink
            href={secondaryCta.href}
            variant={secondaryCta.variant}
            ariaLabel={secondaryCta.ariaLabel}
            className="group"
          >
            <span className="inline-flex items-center gap-2">
              <PlayCircle className="size-5 transition-transform duration-180 group-hover:scale-[1.04]" />
              {secondaryCta.label}
            </span>
          </ButtonLink>
        </div>
      </div>

      <div className="home-reveal [animation-delay:120ms]">
        <KanbanPreview columns={content.hero.boardColumns} liveBadge={content.hero.liveBadge} />
      </div>
    </section>
  );
}
