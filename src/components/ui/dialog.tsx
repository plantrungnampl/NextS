"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";

import { cn } from "@/shared";

type DialogOverlayProps = ComponentProps<typeof DialogPrimitive.Overlay>;
type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content>;

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogOverlay({ className, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      className={cn("fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm", className)}
      {...props}
    />
  );
}

export function DialogContent({ className, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-[#1b2230] p-4 shadow-2xl",
          className,
        )}
        {...props}
      />
    </DialogPortal>
  );
}
