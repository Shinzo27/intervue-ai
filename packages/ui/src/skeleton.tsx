import type { HTMLAttributes } from "react";
import { cn } from "./lib/cn";

/** Placeholder block; size it like the content it stands in for to avoid layout shift. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface-hover)_50%,var(--surface-2)_75%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
