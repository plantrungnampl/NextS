import { features } from "../data/home-content";
import type { UiTheme } from "../types";

type FeatureSectionProps = {
  theme: UiTheme;
};

export function FeatureSection({ theme }: FeatureSectionProps) {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16 md:px-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        Core capabilities
      </p>
      <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
        Strong UX, clear governance, and board speed your team can feel.
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.title}
            className={`motion-rise rounded-3xl p-6 shadow-sm backdrop-blur ${theme.panelSurfaceClass}`}
          >
            <span
              className={`grid size-11 place-items-center rounded-xl ${theme.featureIconClass}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-6 stroke-current stroke-2"
              >
                <path
                  d={feature.icon}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h3 className="mt-4 text-xl font-bold text-slate-900">
              {feature.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {feature.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
