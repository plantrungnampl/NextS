import { ButtonLink } from "../components";
import type { HomeContent } from "../data/home-content";

type FinalCtaSectionProps = {
  content: HomeContent;
};

export function FinalCtaSection({ content }: FinalCtaSectionProps) {
  return (
    <section id="final-cta" className="mx-auto w-full max-w-[1200px] px-6 py-20">
      <div className="rounded-[24px] bg-gradient-to-r from-[#0079BF] to-[#00C4B4] px-6 py-12 text-white shadow-[0_16px_40px_rgba(9,30,66,0.2)] md:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">
          {content.finalCta.eyebrow}
        </p>
        <h2 className="mt-3 text-balance text-[2rem] font-extrabold leading-[1.1] tracking-[-0.03em] md:text-[3rem]">
          {content.finalCta.title}
        </h2>
        <p className="mt-4 max-w-[680px] text-base leading-8 text-white/90 md:text-lg">
          {content.finalCta.description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink
            href={content.finalCta.primaryHref}
            className="bg-white text-[#005A8C] hover:bg-[#F1F5F9]"
          >
            {content.finalCta.primaryLabel}
          </ButtonLink>
          <ButtonLink
            href={content.finalCta.secondaryHref}
            variant="secondary"
            className="border-white/75 bg-transparent text-white hover:bg-white/10"
          >
            {content.finalCta.secondaryLabel}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
