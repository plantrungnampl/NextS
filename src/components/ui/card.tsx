import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/shared";

type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      className={cn("rounded-xl border border-slate-200 bg-white p-6 shadow-sm", className)}
      ref={ref}
      {...props}
    />
  );
});
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, CardProps>(function CardHeader(
  { className, ...props },
  ref,
) {
  return <div className={cn("mb-4 space-y-1", className)} ref={ref} {...props} />;
});
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(function CardTitle(
  { children, className, ...props },
  ref,
) {
  return (
    <h2 className={cn("text-xl font-semibold text-slate-900", className)} ref={ref} {...props}>
      {children ?? <span className="sr-only">Card title</span>}
    </h2>
  );
});
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(function CardDescription(
  { className, ...props },
  ref,
) {
  return <p className={cn("text-sm text-slate-600", className)} ref={ref} {...props} />;
});
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, CardProps>(function CardContent(
  { className, ...props },
  ref,
) {
  return <div className={cn("space-y-4", className)} ref={ref} {...props} />;
});
CardContent.displayName = "CardContent";
