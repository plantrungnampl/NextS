export const CARD_STATUS_VALUES = [
  "todo",
  "in_progress",
  "done",
  "in_review",
  "approved",
  "not_sure",
] as const;

export const CARD_STATUS_ITEMS = [
  { label: "To do", value: "todo" },
  { label: "In progress", value: "in_progress" },
  { label: "Done", value: "done" },
  { label: "In review", value: "in_review" },
  { label: "Approved", value: "approved" },
  { label: "Not sure", value: "not_sure" },
] as const;

export const CARD_STATUS_BADGE_CLASS_BY_VALUE = {
  approved: "!border-emerald-300/80 !bg-emerald-500/30 !text-emerald-50",
  done: "!border-green-300/80 !bg-green-500/30 !text-green-50",
  in_progress: "!border-sky-300/80 !bg-sky-500/30 !text-sky-50",
  in_review: "!border-violet-300/80 !bg-violet-500/30 !text-violet-50",
  not_sure: "!border-rose-300/80 !bg-rose-500/30 !text-rose-50",
  todo: "!border-amber-300/80 !bg-amber-500/30 !text-amber-50",
} satisfies Record<(typeof CARD_STATUS_VALUES)[number], string>;

export const CARD_PRIORITY_VALUES = [
  "highest",
  "high",
  "medium",
  "low",
  "lowest",
  "not_sure",
] as const;

export const CARD_PRIORITY_ITEMS = [
  { label: "--", value: "" },
  { label: "Highest", value: "highest" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Lowest", value: "lowest" },
  { label: "Not sure", value: "not_sure" },
] as const;

export const CARD_PRIORITY_BADGE_CLASS_BY_VALUE = {
  high: "!border-rose-300/80 !bg-rose-500/25 !text-rose-50",
  highest: "!border-red-300/85 !bg-red-500/35 !text-red-50",
  low: "!border-sky-300/80 !bg-sky-500/25 !text-sky-50",
  lowest: "!border-cyan-300/80 !bg-cyan-500/25 !text-cyan-50",
  medium: "!border-amber-300/80 !bg-amber-500/25 !text-amber-50",
  not_sure: "!border-slate-300/75 !bg-slate-500/30 !text-slate-50",
} satisfies Record<(typeof CARD_PRIORITY_VALUES)[number], string>;

export type CardStatusValue = (typeof CARD_STATUS_VALUES)[number];
export type CardPriorityValue = (typeof CARD_PRIORITY_VALUES)[number];
