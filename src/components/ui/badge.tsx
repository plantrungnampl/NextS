import type { HTMLAttributes } from "react";

import { cn } from "@/shared";

type BadgeVariant = "default" | "destructive" | "muted" | "outline";

const badgeVariantClass: Record<BadgeVariant, string> = {
  default: "border-transparent bg-sky-600/90 text-white",
  destructive: "border-transparent bg-rose-600/90 text-white",
  muted: "border-transparent bg-slate-700/80 text-slate-100",
  outline: "border-slate-600 bg-transparent text-slate-200",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        badgeVariantClass[variant],
        className,
      )}
      {...props}
    />
  );
}
