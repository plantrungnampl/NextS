export type UiStyle = "enterprise" | "playful";

export type UiTheme = {
  name: string;
  pageClass: string;
  overlayClass: string;
  focusRingClass: string;
  styleSwitchClass: string;
  navActiveClass: string;
  navIdleClass: string;
  brandBadgeClass: string;
  badgeClass: string;
  heroTitleClass: string;
  heroPanelClass: string;
  panelSurfaceClass: string;
  metricValueClass: string;
  featureIconClass: string;
  pricingShellClass: string;
  pricingEyebrowClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  boardToneClasses: [string, string, string];
};

export type NavLink = {
  label: string;
  href: string;
};

type BoardCard = {
  title: string;
  tag: string;
  owner: string;
};

export type BoardColumn = {
  title: string;
  cards: BoardCard[];
};

export type Metric = {
  value: string;
  label: string;
};

export type Feature = {
  title: string;
  description: string;
  icon: string;
};

export type HomePageSearchParams = {
  style?: string | string[];
};

export type HomePageProps = {
  searchParams?: Promise<HomePageSearchParams> | HomePageSearchParams;
};
