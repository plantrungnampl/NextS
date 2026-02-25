import type { LucideIcon } from "lucide-react";

export type HomeLocale = "en" | "vi";

export type HomeSectionId =
  | "features"
  | "solutions"
  | "templates"
  | "pricing"
  | "resources"
  | "use-cases"
  | "testimonials";

export type HomeButtonVariant = "primary" | "secondary" | "ghost";

export type NavLink = {
  id: HomeSectionId;
  label: string;
  href: string;
};

export type HeroCta = {
  label: string;
  href: string;
  variant: HomeButtonVariant;
  ariaLabel?: string;
};

export type BrandLogoItem = {
  name: string;
};

export type BoardCardPreview = {
  title: string;
  label: string;
  labelClassName: string;
  members: string[];
  dueDate: string;
  checklist: string;
};

export type BoardColumnPreview = {
  title: string;
  cardCount: number;
  cards: BoardCardPreview[];
};

export type FeatureCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
};

export type UseCaseItem = {
  title: string;
  description: string;
  metric: string;
  icon: LucideIcon;
};

export type TestimonialItem = {
  quote: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
};

export type FooterLinkItem = {
  label: string;
  href: string;
};

export type FooterGroup = {
  title: string;
  links: FooterLinkItem[];
};

export type HomePageProps = {
  locale?: HomeLocale;
};
