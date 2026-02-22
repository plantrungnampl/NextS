"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/shared";

export type CalendarProps = ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-1", className)}
      classNames={{
        button_next: "inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800",
        button_previous: "inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800",
        caption_label: "text-sm font-semibold text-slate-100",
        day: "h-8 w-8 p-0 text-sm text-slate-200",
        day_button: "h-8 w-8 rounded-md transition-colors hover:bg-slate-800",
        day_disabled: "text-slate-600",
        day_hidden: "invisible",
        day_outside: "text-slate-500",
        day_selected: "bg-sky-600 text-white hover:bg-sky-600",
        day_today: "border border-amber-400/70",
        dropdown: "rounded-md border border-slate-700 bg-[#0f1318] px-1 text-xs",
        months: "flex flex-col",
        month_caption: "mb-2 flex items-center justify-center gap-1",
        month_grid: "w-full border-collapse",
        nav: "absolute right-1 top-1 flex items-center gap-1",
        root: "relative",
        weekday: "text-[11px] font-medium text-slate-400",
        week: "mt-1 flex w-full",
        weekdays: "flex w-full justify-between",
        ...classNames,
      }}
      components={{
        Chevron: ({ className: iconClassName, orientation, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          ),
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}
