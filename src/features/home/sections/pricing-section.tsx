import type { UiTheme } from "../types";

type PricingSectionProps = {
  theme: UiTheme;
};

export function PricingSection({ theme }: PricingSectionProps) {
  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
      <div className={`rounded-3xl px-6 py-10 md:px-10 ${theme.pricingShellClass}`}>
        <p
          className={`text-sm font-semibold uppercase tracking-[0.2em] ${theme.pricingEyebrowClass}`}
        >
          Launch your next sprint
        </p>
        <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight md:text-4xl">
          From backlog to release, keep every stakeholder aligned and every
          decision traceable.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-100 md:text-base">
          Start free for your first workspace, then scale with advanced admin
          controls, enterprise security, and analytics packs.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href="#start"
            className={`inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#F97316] px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[#EA580C] active:translate-y-px cursor-pointer ${theme.focusRingClass}`}
          >
            Try NexaBoard free
          </a>
          <a
            href="#workflow"
            className={`inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/30 px-6 py-3 text-sm font-semibold text-slate-100 transition duration-200 hover:border-white hover:text-white cursor-pointer ${theme.focusRingClass}`}
          >
            View implementation flow
          </a>
        </div>
      </div>
    </section>
  );
}
