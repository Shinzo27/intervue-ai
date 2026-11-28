"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "./lib/cn";

interface ProgressProps {
  value: number;
  max?: number;
  label: string;
  tone?: "primary" | "ai" | "success" | "warning" | "danger";
  className?: string;
}

const tones = {
  primary: "bg-primary",
  ai: "bg-ai",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function Progress({ value, max = 100, label, tone = "primary", className }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <ProgressPrimitive.Root
      value={value}
      max={max}
      aria-label={label}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full transition-[width] duration-300 ease-out", tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
