import { Check } from "lucide-react";
import { cn } from "./lib/cn";

interface StepperProps {
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
  className?: string;
}

/** Horizontal progress through a short multi-step flow. */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn("flex items-center gap-2", className)} aria-label="Progress">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-2"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                done && "border-primary bg-primary text-on-primary",
                active && "border-primary bg-primary-subtle text-primary",
                !done && !active && "border-border-strong text-muted-fg",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : index + 1}
            </span>
            <span
              className={cn(
                "sr-only text-sm font-medium sm:not-sr-only",
                active || done ? "text-fg" : "text-muted-fg",
              )}
            >
              {label}
              <span className="sr-only">{done ? " (completed)" : active ? " (current)" : ""}</span>
            </span>
            {index < steps.length - 1 && (
              <span aria-hidden className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
