import { getHomeContent } from "./data/home-content";
import {
  DemoSection,
  FeatureSection,
  FinalCtaSection,
  FooterSection,
  HeaderSection,
  HeroSection,
  TestimonialsSection,
  TrustedLogosSection,
  UseCasesSection,
} from "./sections";
import type { HomePageProps } from "./types";

export default function HomePage({ locale = "en" }: HomePageProps = {}) {
  const content = getHomeContent(locale);
  const headerContent = {
    brand: content.brand,
    header: content.header,
    navLinks: content.navLinks,
  };
  const testimonialsContent = content.testimonials;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[var(--home-bg)] text-[var(--home-text-primary)]">
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-[var(--home-surface)] px-4 py-2 text-sm font-semibold text-[var(--home-text-primary)] focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:outline-none focus:ring-3 focus:ring-[#0079BF]/35"
      >
        {content.skipToMainLabel}
      </a>

      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_8%_6%,rgba(0,121,191,0.2),transparent_34%),radial-gradient(circle_at_95%_7%,rgba(0,196,180,0.18),transparent_28%),radial-gradient(circle_at_30%_40%,rgba(0,121,191,0.09),transparent_38%)]" />
      <HeaderSection content={headerContent} />

      <main id="main-content" className="relative z-10">
        <HeroSection content={content} />
        <TrustedLogosSection content={content} />
        <FeatureSection content={content} />
        <DemoSection content={content} />
        <UseCasesSection content={content} />
        <TestimonialsSection content={testimonialsContent} />
        <FinalCtaSection content={content} />
      </main>

      <FooterSection content={content} />
    </div>
  );
}
