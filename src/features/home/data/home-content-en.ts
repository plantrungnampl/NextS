import {
  Bot,
  BriefcaseBusiness,
  Cable,
  Code2,
  GraduationCap,
  Handshake,
  KanbanSquare,
  Megaphone,
  Smartphone,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { APP_ROUTES } from "@/core";
import type {
  BoardColumnPreview,
  BrandLogoItem,
  FeatureCard,
  FooterGroup,
  HeroCta,
  NavLink,
  TestimonialItem,
  UseCaseItem,
} from "../types";
import type { HomeContent } from "./home-content.schema";
const trustedLogos: ReadonlyArray<BrandLogoItem> = [
  { name: "Stripe" },
  { name: "Shopify" },
  { name: "Zoom" },
  { name: "Spotify" },
  { name: "Figma" },
  { name: "Atlassian" },
];
const navLinks: ReadonlyArray<NavLink> = [
  { id: "features", label: "Features", href: "#features" },
  { id: "solutions", label: "Solutions", href: "#use-cases" },
  { id: "templates", label: "Templates", href: "#demo" },
  { id: "pricing", label: "Pricing", href: "#final-cta" },
  { id: "resources", label: "Resources", href: "#footer" },
];
const heroCtas: ReadonlyArray<HeroCta> = [
  {
    label: "Start free",
    href: APP_ROUTES.login,
    variant: "primary",
    ariaLabel: "Start free with NextS",
  },
  {
    label: "Watch 1:45 demo",
    href: "#demo",
    variant: "secondary",
    ariaLabel: "Watch one minute forty-five seconds demo",
  },
];
const heroBoardColumns: ReadonlyArray<BoardColumnPreview> = [
  {
    title: "Planned",
    cardCount: 8,
    cards: [
      {
        title: "Launch onboarding checklist",
        label: "Marketing",
        labelClassName: "bg-[#E3F2FD] text-[#005A8C]",
        members: ["AL", "TS"],
        dueDate: "May 22",
        checklist: "2/5",
      },
      {
        title: "Improve signup drop-off",
        label: "Growth",
        labelClassName: "bg-[#E8F5E9] text-[#136F3A]",
        members: ["ME", "HX"],
        dueDate: "May 24",
        checklist: "1/3",
      },
    ],
  },
  {
    title: "In Progress",
    cardCount: 5,
    cards: [
      {
        title: "Card composer with slash menu",
        label: "Product",
        labelClassName: "bg-[#FFF4E5] text-[#8A4B00]",
        members: ["QN", "TR", "AN"],
        dueDate: "May 19",
        checklist: "4/7",
      },
      {
        title: "Realtime board permission sync",
        label: "Platform",
        labelClassName: "bg-[#F1F0FF] text-[#4E44CE]",
        members: ["PM", "LK"],
        dueDate: "May 20",
        checklist: "3/4",
      },
    ],
  },
  {
    title: "Review",
    cardCount: 3,
    cards: [
      {
        title: "Automation rule test matrix",
        label: "QA",
        labelClassName: "bg-[#E0F7FA] text-[#00626B]",
        members: ["NH", "DV"],
        dueDate: "May 18",
        checklist: "6/6",
      },
      {
        title: "Executive status snapshot",
        label: "Ops",
        labelClassName: "bg-[#FCE4EC] text-[#8D1B4C]",
        members: ["GT"],
        dueDate: "May 21",
        checklist: "2/2",
      },
    ],
  },
];
const featureCards: ReadonlyArray<FeatureCard> = [
  {
    title: "Visual Kanban boards",
    description:
      "Map priorities with lanes, card metadata, and flexible workflows your team can scan in seconds.",
    icon: KanbanSquare,
    href: "#demo",
  },
  {
    title: "Real-time collaboration",
    description:
      "See teammate presence, card updates, and comments happen instantly without manual refresh loops.",
    icon: Users,
    href: "#testimonials",
  },
  {
    title: "Butler automation",
    description:
      "Automate recurring busywork with triggers and actions that keep delivery moving 24/7.",
    icon: Workflow,
    href: "#demo",
  },
  {
    title: "AI smart suggestions",
    description:
      "Let AI suggest labels, due dates, and next steps from context so planning starts faster.",
    icon: Bot,
    href: "#features",
  },
  {
    title: "Mobile apps that keep up",
    description:
      "Capture ideas, move cards, and unblock teammates from your phone while away from your desk.",
    icon: Smartphone,
    href: "#use-cases",
  },
  {
    title: "Power-Ups and integrations",
    description:
      "Plug NextS into your stack with Slack, Drive, Jira, GitHub, and custom workflows.",
    icon: Cable,
    href: "#footer",
  },
];
const demoBoardColumns: ReadonlyArray<BoardColumnPreview> = [
  {
    title: "Incoming",
    cardCount: 11,
    cards: [
      {
        title: "Collect launch campaign requests",
        label: "Intake",
        labelClassName: "bg-[#E3F2FD] text-[#005A8C]",
        members: ["MP", "AN"],
        dueDate: "Today",
        checklist: "1/4",
      },
      {
        title: "Draft customer webinar script",
        label: "Content",
        labelClassName: "bg-[#FFF4E5] text-[#8A4B00]",
        members: ["TL"],
        dueDate: "Tomorrow",
        checklist: "2/6",
      },
    ],
  },
  {
    title: "Building",
    cardCount: 7,
    cards: [
      {
        title: "Refine board template library",
        label: "Template",
        labelClassName: "bg-[#F1F0FF] text-[#4E44CE]",
        members: ["LX", "PR"],
        dueDate: "May 23",
        checklist: "5/8",
      },
      {
        title: "AI next-step recommendation",
        label: "AI",
        labelClassName: "bg-[#E0F7FA] text-[#00626B]",
        members: ["HT", "DR"],
        dueDate: "May 24",
        checklist: "4/5",
      },
    ],
  },
  {
    title: "Shipped",
    cardCount: 14,
    cards: [
      {
        title: "Auto-assign based on skill tags",
        label: "Automation",
        labelClassName: "bg-[#E8F5E9] text-[#136F3A]",
        members: ["SM", "KR"],
        dueDate: "Done",
        checklist: "3/3",
      },
      {
        title: "iOS quick capture flow",
        label: "Mobile",
        labelClassName: "bg-[#FCE4EC] text-[#8D1B4C]",
        members: ["RX"],
        dueDate: "Done",
        checklist: "4/4",
      },
    ],
  },
];
const useCases: ReadonlyArray<UseCaseItem> = [
  {
    title: "Marketing teams",
    description:
      "Run campaigns with clear owners, launch timelines, and creative approvals in one board.",
    metric: "32% faster campaign handoff",
    icon: Megaphone,
  },
  {
    title: "Engineering",
    description:
      "Plan sprints, track dependencies, and align product + engineering status in real time.",
    metric: "2.1x sprint planning speed",
    icon: Code2,
  },
  {
    title: "HR",
    description:
      "Standardize hiring pipelines and onboarding checklists with reusable workflow templates.",
    metric: "45% fewer manual reminders",
    icon: BriefcaseBusiness,
  },
  {
    title: "Education",
    description:
      "Coordinate class projects, assignment reviews, and milestone visibility for cohorts.",
    metric: "89% on-time submissions",
    icon: GraduationCap,
  },
  {
    title: "Personal planning",
    description:
      "Organize goals, routines, and side projects with lightweight boards that stay motivating.",
    metric: "Daily planning in under 5 minutes",
    icon: Sparkles,
  },
  {
    title: "Operations",
    description:
      "Keep recurring processes documented and automated across teams without spreadsheet chaos.",
    metric: "27% fewer operational incidents",
    icon: Handshake,
  },
];
const testimonials: ReadonlyArray<TestimonialItem> = [
  {
    quote:
      "NextS replaced three disconnected tools in two weeks. Our launch board finally reflects reality every hour.",
    name: "Lena Park",
    role: "Head of Product",
    company: "PilotLoop",
    avatar: "LP",
  },
  {
    quote:
      "The board feels alive. Drag-and-drop is smooth, automations are reliable, and the team actually enjoys using it.",
    name: "Marco Silva",
    role: "Engineering Manager",
    company: "Northstack",
    avatar: "MS",
  },
  {
    quote:
      "We moved campaign planning into NextS and cut weekly status meetings by half without losing visibility.",
    name: "Ava Tran",
    role: "Marketing Director",
    company: "Nebula Labs",
    avatar: "AT",
  },
  {
    quote:
      "The mobile app keeps our field team aligned. Updates land instantly and everyone sees the same priorities.",
    name: "Chris Walker",
    role: "Operations Lead",
    company: "Flowpoint",
    avatar: "CW",
  },
  {
    quote:
      "AI smart suggestions are subtle but useful. New hires ramp up faster because cards are easier to triage.",
    name: "Nora Lee",
    role: "People Ops Manager",
    company: "BasisOne",
    avatar: "NL",
  },
  {
    quote:
      "Power-Ups made the transition painless. We connected Slack and GitHub in minutes and stopped context switching.",
    name: "Ibrahim Khan",
    role: "CTO",
    company: "Threadline",
    avatar: "IK",
  },
];
const footerGroups: ReadonlyArray<FooterGroup> = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Templates", href: "#demo" },
      { label: "Mobile Apps", href: "#features" },
      { label: "Pricing", href: "#final-cta" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Marketing", href: "#use-cases" },
      { label: "Engineering", href: "#use-cases" },
      { label: "Operations", href: "#use-cases" },
      { label: "Education", href: "#use-cases" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help Center", href: "#footer" },
      { label: "Community", href: "#footer" },
      { label: "API Docs", href: "#footer" },
      { label: "Changelog", href: "#footer" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#footer" },
      { label: "Careers", href: "#footer" },
      { label: "Security", href: "#footer" },
      { label: "Contact", href: "#footer" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "#footer" },
      { label: "Privacy", href: "#footer" },
      { label: "Cookie policy", href: "#footer" },
      { label: "Status", href: "#footer" },
    ],
  },
];
export const homeContentEn: HomeContent = {
  locale: "en",
  metadata: {
    title: "NextS | Visual collaboration that actually works",
    description:
      "Plan and deliver faster with Kanban boards, realtime collaboration, Butler automation, and AI smart suggestions.",
    alternates: {
      canonical: "/",
      languages: {
        en: "/",
        vi: "/vi",
      },
    },
  },
  skipToMainLabel: "Skip to main content",
  brand: {
    iconLabel: "NS",
    name: "NextS",
    subtitle: "Visual collaboration",
    homeHref: APP_ROUTES.home,
    homeAriaLabel: "NextS home",
    localeSwitchHref: APP_ROUTES.homeVi,
    localeSwitchLabel: "VI",
    localeDisplayLabel: "English (US)",
  },
  header: {
    loginLabel: "Log in",
    getStartedLabel: "Get started - free",
    workspaceLabel: "Go to workspace",
    primaryNavAriaLabel: "Primary",
    mobileNavAriaLabel: "Mobile",
    openMenuAriaLabel: "Open navigation menu",
    closeMenuAriaLabel: "Close navigation menu",
  },
  navLinks,
  hero: {
    badge: "Visual collaboration that actually works",
    title: "Work flows better on visual boards for teams",
    description:
      "Plan with Kanban boards, move cards with drag and drop, and keep teams aligned through realtime updates, AI suggestions, and Butler automation.",
    ctas: heroCtas,
    boardColumns: heroBoardColumns,
    liveBadge: "12 teammates online",
  },
  trusted: {
    title: "Trusted by teams at",
    logos: trustedLogos,
  },
  features: {
    eyebrow: "Core Features",
    title: "Everything your team needs to plan and ship",
    description:
      "From visual boards to automation and AI assistance, NextS keeps your execution flow clean, fast, and visible.",
    learnMoreLabel: "Learn more",
    cards: featureCards,
  },
  demo: {
    eyebrow: "See It In Action",
    title: "A board that feels interactive from first click",
    description:
      "Get a live-looking preview of workflows with card movements, timeline updates, and automation insights.",
    boardColumns: demoBoardColumns,
    liveBadge: "Realtime timeline synced",
    timelineTitle: "Activity timeline",
    timelineEvents: [
      {
        title: "Rule triggered: Auto-assign PM review",
        time: "2 seconds ago",
      },
      {
        title: "AI suggested due date for launch card",
        time: "18 seconds ago",
      },
      {
        title: "Board synced to mobile app",
        time: "1 minute ago",
      },
    ],
    aiBadge: "AI enabled",
    butlerBadge: "Butler running",
    templateButtonLabel: "Try this template",
  },
  useCases: {
    eyebrow: "For Every Team",
    title: "Use NextS the way your work actually runs",
    description:
      "Purpose-built workflows for marketing, engineering, HR, education, operations, and personal planning.",
    items: useCases,
  },
  testimonials: {
    eyebrow: "Customer Stories",
    title: "Loved by teams that ship every week",
    description:
      "Real voices from product, engineering, marketing, and operations leaders running work on NextS.",
    dotAriaLabel: "View testimonial",
    previousAriaLabel: "Previous testimonials",
    nextAriaLabel: "Next testimonials",
    items: testimonials,
  },
  finalCta: {
    eyebrow: "Ready when your team is",
    title: "Ready to organize your team?",
    description:
      "Start for free in minutes, invite your team instantly, and turn incoming work into a visual workflow everyone can trust.",
    primaryLabel: "Get started free",
    primaryHref: APP_ROUTES.login,
    secondaryLabel: "Talk to sales",
    secondaryHref: "#footer",
  },
  footer: {
    description: "NextS helps teams visualize, automate, and deliver work together.",
    socialAriaLabel: "Social link",
    groups: footerGroups,
    copyright: "© 2026 NextS, Inc. All rights reserved.",
  },
};
