import type { Metadata } from "next";

import type {
  BoardColumnPreview,
  BrandLogoItem,
  FeatureCard,
  FooterGroup,
  HeroCta,
  HomeLocale,
  NavLink,
  TestimonialItem,
  UseCaseItem,
} from "../types";

export type HomeContent = {
  locale: HomeLocale;
  metadata: Metadata;
  skipToMainLabel: string;
  brand: {
    iconLabel: string;
    name: string;
    subtitle: string;
    homeHref: string;
    homeAriaLabel: string;
    localeSwitchHref: string;
    localeSwitchLabel: string;
    localeDisplayLabel: string;
  };
  header: {
    loginLabel: string;
    getStartedLabel: string;
    workspaceLabel: string;
    primaryNavAriaLabel: string;
    mobileNavAriaLabel: string;
    openMenuAriaLabel: string;
    closeMenuAriaLabel: string;
  };
  navLinks: ReadonlyArray<NavLink>;
  hero: {
    badge: string;
    title: string;
    description: string;
    ctas: ReadonlyArray<HeroCta>;
    boardColumns: ReadonlyArray<BoardColumnPreview>;
    liveBadge: string;
  };
  trusted: {
    title: string;
    logos: ReadonlyArray<BrandLogoItem>;
  };
  features: {
    eyebrow: string;
    title: string;
    description: string;
    learnMoreLabel: string;
    cards: ReadonlyArray<FeatureCard>;
  };
  demo: {
    eyebrow: string;
    title: string;
    description: string;
    boardColumns: ReadonlyArray<BoardColumnPreview>;
    liveBadge: string;
    timelineTitle: string;
    timelineEvents: ReadonlyArray<{ title: string; time: string }>;
    aiBadge: string;
    butlerBadge: string;
    templateButtonLabel: string;
  };
  useCases: {
    eyebrow: string;
    title: string;
    description: string;
    items: ReadonlyArray<UseCaseItem>;
  };
  testimonials: {
    eyebrow: string;
    title: string;
    description: string;
    dotAriaLabel: string;
    previousAriaLabel: string;
    nextAriaLabel: string;
    items: ReadonlyArray<TestimonialItem>;
  };
  finalCta: {
    eyebrow: string;
    title: string;
    description: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
  footer: {
    description: string;
    socialAriaLabel: string;
    groups: ReadonlyArray<FooterGroup>;
    copyright: string;
  };
};
