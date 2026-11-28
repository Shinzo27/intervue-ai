import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium leading-4 [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-border bg-surface-2 text-muted-fg",
        primary: "border-transparent bg-primary-subtle text-primary",
        ai: "border-transparent bg-ai-subtle text-ai",
        success: "border-transparent bg-success-subtle text-success",
        warning: "border-transparent bg-warning-subtle text-warning",
        danger: "border-transparent bg-danger-subtle text-danger",
        outline: "border-border-strong bg-transparent text-fg",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Leading status dot in the badge colour. */
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
