import { metrics } from "../data/home-content";
import type { UiTheme } from "../types";

type MetricsSectionProps = {
  theme: UiTheme;
};

export function MetricsSection({ theme }: MetricsSectionProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-5 md:px-10">
      <div className="grid gap-4 rounded-3xl border border-white/75 bg-white/70 p-4 shadow-sm backdrop-blur md:grid-cols-4">
        {metrics.map((item) => (
          <article
            key={item.label}
            className={`rounded-2xl p-4 ${theme.panelSurfaceClass}`}
          >
            <p className={`text-3xl font-black ${theme.metricValueClass}`}>
              {item.value}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.label}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
