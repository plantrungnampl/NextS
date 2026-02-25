import type { ReactNode } from "react";

import type { HomeButtonVariant } from "../types";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: HomeButtonVariant;
  ariaLabel?: string;
  className?: string;
};

const baseClassName =
  "inline-flex min-h-[52px] items-center justify-center rounded-[14px] px-6 text-base font-bold transition-transform duration-180 ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0079BF]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--home-bg)]";

const variantClassNames: Record<HomeButtonVariant, string> = {
  primary:
    "bg-[#0079BF] text-white shadow-[0_8px_24px_rgba(9,30,66,0.14)] hover:-translate-y-px hover:bg-[#026AA7] hover:shadow-[0_12px_28px_rgba(9,30,66,0.18)] active:translate-y-0",
  secondary:
    "border border-[#0079BF] bg-[var(--home-surface)] text-[#0079BF] hover:-translate-y-px hover:bg-[#0079BF]/8 active:translate-y-0",
  ghost:
    "bg-transparent text-[var(--home-text-primary)] hover:bg-[var(--home-surface)]/80",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  ariaLabel,
  className,
}: ButtonLinkProps) {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      className={`${baseClassName} ${variantClassNames[variant]} ${className ?? ""}`.trim()}
    >
      {children}
    </a>
  );
}
