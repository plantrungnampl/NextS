"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type { ComponentProps } from "react";

import { cn } from "@/shared";

type ScrollAreaProps = ComponentProps<typeof ScrollAreaPrimitive.Root>;
type ScrollBarProps = ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>;
type ScrollAreaWithBarsProps = ScrollAreaProps & {
  showHorizontalScrollbar?: boolean;
  showVerticalScrollbar?: boolean;
};

export function ScrollArea({
  children,
  className,
  showHorizontalScrollbar = false,
  showVerticalScrollbar = true,
  ...props
}: ScrollAreaWithBarsProps) {
  return (
    <ScrollAreaPrimitive.Root className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      {showVerticalScrollbar ? <ScrollBar orientation="vertical" /> : null}
      {showHorizontalScrollbar ? <ScrollBar orientation="horizontal" /> : null}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollBar({ className, orientation = "vertical", ...props }: ScrollBarProps) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      className={cn(
        "flex touch-none select-none transition-colors",
        orientation === "vertical" ? "h-full w-2.5 border-l border-l-transparent p-[1px]" : "h-2.5 flex-col border-t border-t-transparent p-[1px]",
        className,
      )}
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-slate-700/80" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}
