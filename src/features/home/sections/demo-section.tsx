import { Sparkles, WandSparkles } from "lucide-react";

import { APP_ROUTES } from "@/core";

import { ButtonLink, KanbanPreview, SectionHeading } from "../components";
import type { HomeContent } from "../data/home-content";

type DemoSectionProps = {
  content: HomeContent;
};

export function DemoSection({ content }: DemoSectionProps) {
  return (
    <section id="demo" className="mx-auto w-full max-w-[1200px] px-6 py-20">
      <div className="rounded-[24px] border border-[#9EDDE4] bg-gradient-to-br from-[#EAF4FB] via-[var(--home-surface)] to-[#E6FAF7] p-6 shadow-[var(--home-shadow-popover)] md:p-8">
        <SectionHeading
          eyebrow={content.demo.eyebrow}
          title={content.demo.title}
          description={content.demo.description}
        />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <KanbanPreview
            columns={content.demo.boardColumns}
            liveBadge={content.demo.liveBadge}
          />

          <aside className="rounded-[18px] border border-[#B5E6EA] bg-[var(--home-surface)]/92 p-5">
            <h3 className="text-xl font-bold tracking-[-0.02em] text-[var(--home-text-primary)]">
              {content.demo.timelineTitle}
            </h3>
            <div className="mt-4 space-y-3">
              {content.demo.timelineEvents.map((event, eventIndex) => (
                <div
                  key={`${event.title}-${eventIndex}`}
                  className="home-timeline-pulse rounded-xl border border-[#D4E8F5] bg-[#F8FCFF] p-3"
                  style={{ animationDelay: `${eventIndex * 120}ms` }}
                >
                  <p className="text-sm font-semibold text-[var(--home-text-primary)]">
                    {event.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--home-text-secondary)]">{event.time}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF4FB] px-3 py-1 text-xs font-semibold text-[#005A8C]">
                <Sparkles className="size-3.5" />
                {content.demo.aiBadge}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E6FAF7] px-3 py-1 text-xs font-semibold text-[#036E67]">
                <WandSparkles className="size-3.5" />
                {content.demo.butlerBadge}
              </span>
            </div>
            <ButtonLink
              href={APP_ROUTES.login}
              variant="secondary"
              className="mt-6 w-full text-sm"
            >
              {content.demo.templateButtonLabel}
            </ButtonLink>
          </aside>
        </div>
      </div>
    </section>
  );
}
