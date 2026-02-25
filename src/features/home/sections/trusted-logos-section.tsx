import type { HomeContent } from "../data/home-content";

type TrustedLogosSectionProps = {
  content: HomeContent;
};

export function TrustedLogosSection({ content }: TrustedLogosSectionProps) {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-6 pb-16">
      <div className="rounded-[16px] border border-[var(--home-border-soft)] bg-[var(--home-surface)] p-5 shadow-[0_8px_24px_rgba(9,30,66,0.08)]">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-[var(--home-text-secondary)]">
          {content.trusted.title}
        </p>
        <div className="mt-5 overflow-hidden">
          <div className="home-logo-track flex min-w-max items-center gap-3">
            {[...content.trusted.logos, ...content.trusted.logos].map((logo, logoIndex) => (
              <span
                key={`${logo.name}-${logoIndex}`}
                className="inline-flex min-h-[44px] min-w-[140px] items-center justify-center rounded-xl border border-[#E3E8EE] bg-[var(--home-surface)] px-4 text-sm font-semibold text-[var(--home-text-secondary)]"
              >
                {logo.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
