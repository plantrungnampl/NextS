"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type { ComponentProps } from "react";

import { cn } from "@/shared";

type AvatarProps = ComponentProps<typeof AvatarPrimitive.Root>;
type AvatarImageProps = ComponentProps<typeof AvatarPrimitive.Image>;
type AvatarFallbackProps = ComponentProps<typeof AvatarPrimitive.Fallback>;

export function Avatar({ className, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn("relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

export function AvatarImage({ className, ...props }: AvatarImageProps) {
  return (
    <AvatarPrimitive.Image
      className={cn("aspect-square h-full w-full object-cover", className)}
      {...props}
    />
  );
}

export function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      className={cn("flex h-full w-full items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-slate-100", className)}
      {...props}
    />
  );
}
