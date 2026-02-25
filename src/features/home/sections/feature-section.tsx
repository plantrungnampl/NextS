import { ArrowRight } from "lucide-react";

import { SectionHeading } from "../components";
import type { HomeContent } from "../data/home-content";

type FeatureSectionProps = {
  content: HomeContent;
};

export function FeatureSection({ content }: FeatureSectionProps) {
  return (
    <section id="features" className="mx-auto w-full max-w-[1200px] px-6 py-20">
      <SectionHeading
        eyebrow={content.features.eyebrow}
        title={content.features.title}
        description={content.features.description}
      />
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {content.features.cards.map((feature, featureIndex) => {
          const Icon = feature.icon;

          return (
            <article
              key={feature.title}
              className="home-reveal rounded-[16px] border border-[var(--home-border-soft)] bg-[var(--home-surface)] p-6 shadow-[0_8px_24px_rgba(9,30,66,0.08)]"
              style={{ animationDelay: `${featureIndex * 50}ms` }}
            >
              <span className="inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0079BF] to-[#00C4B4] text-white shadow-[0_8px_20px_rgba(0,121,191,0.24)]">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-[1.75rem] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--home-text-primary)]">
                {feature.title}
              </h3>
              <p className="mt-3 text-base leading-7 text-[var(--home-text-secondary)]">
                {feature.description}
              </p>
              <a
                href={feature.href}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0079BF] transition-transform duration-180 hover:translate-x-0.5"
              >
                {content.features.learnMoreLabel}
                <ArrowRight className="size-4" />
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
