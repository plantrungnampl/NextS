import { ArrowUpRight } from "lucide-react";

import { SectionHeading } from "../components";
import type { HomeContent } from "../data/home-content";

type UseCasesSectionProps = {
  content: HomeContent;
};

export function UseCasesSection({ content }: UseCasesSectionProps) {
  return (
    <section id="use-cases" className="mx-auto w-full max-w-[1200px] px-6 py-20">
      <SectionHeading
        eyebrow={content.useCases.eyebrow}
        title={content.useCases.title}
        description={content.useCases.description}
      />
      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
        {content.useCases.items.map((useCase, useCaseIndex) => {
          const Icon = useCase.icon;

          return (
            <article
              key={useCase.title}
              className="home-reveal rounded-[16px] border border-[var(--home-border-soft)] bg-[var(--home-surface)] p-5 shadow-[0_8px_24px_rgba(9,30,66,0.08)]"
              style={{ animationDelay: `${useCaseIndex * 40}ms` }}
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#F4F5F7] text-[#0079BF]">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-xl font-bold tracking-[-0.02em] text-[var(--home-text-primary)] lg:text-[1.75rem]">
                {useCase.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--home-text-secondary)] lg:text-base lg:leading-7">
                {useCase.description}
              </p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0079BF]">
                {useCase.metric}
                <ArrowUpRight className="size-4" />
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
