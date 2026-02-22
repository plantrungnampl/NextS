import { steps } from "../data/home-content";
import type { UiTheme } from "../types";

type WorkflowSectionProps = {
  theme: UiTheme;
};

export function WorkflowSection({ theme }: WorkflowSectionProps) {
  return (
    <section id="workflow" className="mx-auto w-full max-w-6xl px-6 pb-16 md:px-10">
      <div className={`rounded-3xl p-6 shadow-sm md:p-10 ${theme.panelSurfaceClass}`}>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Workflow
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={`step-${index + 1}`} className="rounded-2xl bg-slate-50 p-5">
              <p className="text-xs font-semibold tracking-[0.15em] text-slate-400">
                STEP {index + 1}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-700">{step}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
