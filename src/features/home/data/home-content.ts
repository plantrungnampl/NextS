import type {
  BoardColumn,
  Feature,
  Metric,
  NavLink,
  UiStyle,
  UiTheme,
} from "../types";

const enterpriseTheme: UiTheme = {
  name: "Enterprise",
  pageClass: "bg-slate-100 text-slate-900",
  overlayClass:
    "bg-[radial-gradient(circle_at_8%_8%,rgba(14,165,233,0.2),transparent_34%),radial-gradient(circle_at_95%_8%,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_30%_42%,rgba(99,102,241,0.12),transparent_35%)]",
  focusRingClass:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100",
  styleSwitchClass: "border border-slate-200 bg-white/80 shadow-sm backdrop-blur",
  navActiveClass: "bg-slate-900 text-white shadow-sm",
  navIdleClass: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  brandBadgeClass: "from-[#0F172A] to-[#2563EB]",
  badgeClass: "border border-blue-200 bg-blue-100/80 text-blue-700 shadow-sm",
  heroTitleClass: "text-slate-900",
  heroPanelClass:
    "border border-slate-200 bg-white/75 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl",
  panelSurfaceClass: "border border-slate-200 bg-white/92",
  metricValueClass: "text-[#1D4ED8]",
  featureIconClass: "bg-blue-50 text-blue-700",
  pricingShellClass:
    "bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] text-white shadow-[0_20px_50px_rgba(15,23,42,0.35)]",
  pricingEyebrowClass: "text-blue-100",
  primaryButtonClass: "bg-[#2563EB] text-white hover:bg-[#1D4ED8]",
  secondaryButtonClass:
    "border border-slate-300 bg-white text-slate-700 hover:border-[#2563EB] hover:text-[#1D4ED8]",
  boardToneClasses: [
    "from-sky-500 to-blue-500",
    "from-emerald-500 to-teal-400",
    "from-fuchsia-500 to-violet-500",
  ],
};

const playfulTheme: UiTheme = {
  name: "Playful",
  pageClass: "bg-[#FFF7ED] text-[#1F2937]",
  overlayClass:
    "bg-[radial-gradient(circle_at_8%_8%,rgba(16,185,129,0.24),transparent_34%),radial-gradient(circle_at_98%_5%,rgba(249,115,22,0.2),transparent_28%),radial-gradient(circle_at_36%_38%,rgba(236,72,153,0.18),transparent_35%)]",
  focusRingClass:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5A4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF7ED]",
  styleSwitchClass:
    "border border-orange-100 bg-white/70 shadow-sm backdrop-blur-md",
  navActiveClass: "bg-white text-slate-900 shadow-sm",
  navIdleClass: "text-slate-600 hover:bg-white/90 hover:text-slate-900",
  brandBadgeClass: "from-[#FB7185] to-[#F59E0B]",
  badgeClass:
    "border border-fuchsia-200 bg-fuchsia-100/80 text-fuchsia-700 shadow-sm",
  heroTitleClass: "text-[#1E293B]",
  heroPanelClass:
    "border border-orange-100 bg-white/72 shadow-[0_24px_70px_rgba(249,115,22,0.16)] backdrop-blur-xl",
  panelSurfaceClass: "border border-orange-100 bg-white/92",
  metricValueClass: "text-[#0F766E]",
  featureIconClass: "bg-emerald-50 text-emerald-700",
  pricingShellClass:
    "bg-gradient-to-r from-[#0F766E] to-[#0369A1] text-white shadow-[0_20px_50px_rgba(8,47,73,0.35)]",
  pricingEyebrowClass: "text-cyan-100",
  primaryButtonClass: "bg-[#F97316] text-white hover:bg-[#EA580C]",
  secondaryButtonClass:
    "border border-orange-200 bg-white/90 text-slate-700 hover:border-[#F97316] hover:text-[#C2410C]",
  boardToneClasses: [
    "from-pink-500 to-orange-400",
    "from-emerald-500 to-teal-400",
    "from-amber-500 to-yellow-400",
  ],
};

export const uiThemes: Record<UiStyle, UiTheme> = {
  enterprise: enterpriseTheme,
  playful: playfulTheme,
};

export const navLinks: ReadonlyArray<NavLink> = [
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Pricing", href: "#pricing" },
];

export const boardColumns: ReadonlyArray<BoardColumn> = [
  {
    title: "Backlog",
    cards: [
      { title: "Auth scopes for guest users", tag: "Security", owner: "HN" },
      { title: "Mobile drag-and-drop polish", tag: "UX", owner: "AL" },
      { title: "Billing portal edge cases", tag: "SaaS", owner: "QT" },
    ],
  },
  {
    title: "In Progress",
    cards: [
      { title: "Sprint analytics widgets", tag: "Insights", owner: "TR" },
      { title: "Template board gallery", tag: "Product", owner: "DK" },
      { title: "Command menu shortcuts", tag: "Power", owner: "LP" },
    ],
  },
  {
    title: "Ready to Ship",
    cards: [
      { title: "Comment mentions + inbox", tag: "Collab", owner: "MN" },
      { title: "Bulk move with filters", tag: "Automation", owner: "PH" },
      { title: "Status SLA reminders", tag: "Ops", owner: "VX" },
    ],
  },
];

export const metrics: ReadonlyArray<Metric> = [
  { value: "3.2M", label: "tasks moved monthly" },
  { value: "99.95%", label: "uptime on live workspaces" },
  { value: "6x", label: "faster sprint planning cycles" },
  { value: "2.3h", label: "average weekly time saved per squad" },
];

export const features: ReadonlyArray<Feature> = [
  {
    title: "Realtime board collaboration",
    description:
      "Multiple members can plan and edit in parallel without stale state or conflicting priorities.",
    icon: "M5 12h14M12 5v14",
  },
  {
    title: "Automation that removes busywork",
    description:
      "Define rules for assignments, status transitions, and reminders with clean, auditable actions.",
    icon: "M6 13l4 4 8-10",
  },
  {
    title: "Decision-ready delivery analytics",
    description:
      "See cycle time, blocked work, and throughput trends in one place that leaders can trust.",
    icon: "M4 18l6-6 4 4 6-8",
  },
];

export const steps: ReadonlyArray<string> = [
  "Capture requests from product, support, and internal ops in a single intake lane.",
  "Prioritize with effort and impact signals so teams ship high-value work first.",
  "Track execution in real time with clear ownership, SLA status, and dependency visibility.",
];
