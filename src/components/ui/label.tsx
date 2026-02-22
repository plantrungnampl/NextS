import type { LabelHTMLAttributes } from "react";

import { cn } from "@/shared";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn("text-sm font-medium text-slate-700", className)} {...props} />;
}
