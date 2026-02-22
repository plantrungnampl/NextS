import { uiThemes } from "./data/home-content";
import { resolveHomeStyle } from "./lib";
import {
  FeatureSection,
  HeaderSection,
  HeroSection,
  MetricsSection,
  PricingSection,
  WorkflowSection,
} from "./sections";
import type { HomePageProps } from "./types";

export default async function HomePage({ searchParams }: HomePageProps) {
  const currentStyle = await resolveHomeStyle(searchParams);
  const theme = uiThemes[currentStyle];

  return (
    <div className={`relative min-h-screen overflow-x-clip ${theme.pageClass}`}>
      <a
        href="#main-content"
        className={`sr-only rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 ${theme.focusRingClass}`}
      >
        Skip to main content
      </a>
      <div className={`pointer-events-none absolute inset-0 z-0 ${theme.overlayClass}`} />
      <HeaderSection theme={theme} currentStyle={currentStyle} />
      <main id="main-content" className="relative z-10">
        <HeroSection theme={theme} />
        <MetricsSection theme={theme} />
        <FeatureSection theme={theme} />
        <WorkflowSection theme={theme} />
        <PricingSection theme={theme} />
      </main>
    </div>
  );
}
