"use client";

import { CheckCircle2, Circle } from "lucide-react";

import { cn } from "@/shared";

type CompletionCircleHintProps = {
  checked?: boolean;
  className?: string;
  disabled?: boolean;
  onToggle?: () => void;
  tooltipSide?: "bottom" | "top";
};

export function CompletionCircleHint({
  checked = false,
  className,
  disabled = false,
  onToggle,
  tooltipSide = "top",
}: CompletionCircleHintProps) {
  const tooltipText = checked ? "Đánh dấu chưa hoàn tất" : "Đánh dấu hoàn tất";
  return (
    <span className={cn("group relative inline-flex shrink-0", className)}>
      <button
        aria-label={tooltipText}
        aria-pressed={checked}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
          checked ? "text-cyan-300 hover:text-cyan-200" : "text-slate-300 hover:text-slate-100",
          disabled ? "cursor-not-allowed opacity-50" : "",
        )}
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle?.();
          if (event.detail > 0) {
            event.currentTarget.blur();
          }
        }}
        type="button"
      >
        {checked ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </button>
      <span
        className={cn(
          "pointer-events-none absolute left-0 z-[80] max-w-[220px] whitespace-nowrap rounded-md border border-white/15 bg-[#0f1420]/95 px-2 py-1 text-xs font-medium text-slate-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
          tooltipSide === "bottom" ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]",
        )}
        role="tooltip"
      >
        {tooltipText}
      </span>
    </span>
  );
}
