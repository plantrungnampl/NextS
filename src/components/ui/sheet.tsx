"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";

import { cn } from "@/shared";

type SheetSide = "bottom" | "left" | "right" | "top";
type SheetOverlayProps = ComponentProps<typeof DialogPrimitive.Overlay>;
type SheetContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  side?: SheetSide;
};

const sideClassMap: Record<SheetSide, string> = {
  bottom:
    "inset-x-0 bottom-0 max-h-[95dvh] rounded-t-2xl border-t border-slate-700 bg-[#1b2230] data-[state=closed]:translate-y-full data-[state=open]:translate-y-0",
  left:
    "inset-y-0 left-0 h-full w-[min(92vw,420px)] rounded-r-2xl border-r border-slate-700 bg-[#1b2230] data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0",
  right:
    "inset-y-0 right-0 h-full w-[min(92vw,420px)] rounded-l-2xl border-l border-slate-700 bg-[#1b2230] data-[state=closed]:translate-x-full data-[state=open]:translate-x-0",
  top:
    "inset-x-0 top-0 max-h-[95dvh] rounded-b-2xl border-b border-slate-700 bg-[#1b2230] data-[state=closed]:-translate-y-full data-[state=open]:translate-y-0",
};

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetPortal = DialogPrimitive.Portal;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export function SheetOverlay({ className, ...props }: SheetOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

export function SheetContent({
  className,
  side = "right",
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 transform-gpu p-0 shadow-2xl transition-transform duration-200 ease-out focus-visible:outline-none",
          sideClassMap[side],
          className,
        )}
        {...props}
      />
    </SheetPortal>
  );
}
