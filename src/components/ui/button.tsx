import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/shared";

const buttonBaseClass =
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:translate-y-px cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const buttonVariantClass = {
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  primary: "bg-sky-600 text-white shadow-sm shadow-sky-300/30 hover:bg-sky-700",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
} as const;

type ButtonVariant = keyof typeof buttonVariantClass;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={cn(buttonBaseClass, buttonVariantClass[variant], className)} {...props} />;
}
