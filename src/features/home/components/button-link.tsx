import type { ReactNode } from "react";

import type { UiTheme } from "../types";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  theme: UiTheme;
  variant?: "primary" | "secondary";
  ariaLabel?: string;
};

export function ButtonLink({
  href,
  children,
  theme,
  variant = "primary",
  ariaLabel,
}: ButtonLinkProps) {
  const commonClass =
    "inline-flex min-h-11 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition duration-200 ease-out active:translate-y-px cursor-pointer";
  const variantClass =
    variant === "primary" ? theme.primaryButtonClass : theme.secondaryButtonClass;

  return (
    <a
      href={href}
      aria-label={ariaLabel}
      className={`${commonClass} ${variantClass} ${theme.focusRingClass}`}
    >
      {children}
    </a>
  );
}
