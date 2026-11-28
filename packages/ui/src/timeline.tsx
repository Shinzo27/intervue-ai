import type { ReactNode } from "react";
import { cn } from "./lib/cn";

export interface TimelineItem {
  id: string;
  icon: ReactNode;
  /** Colour of the icon dot: AI actions use "ai", humans "primary", system "neutral". */
  tone?: "ai" | "primary" | "neutral" | "warning";
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}

const tones = {
  ai: "bg-ai-subtle text-ai",
  primary: "bg-primary-subtle text-primary",
  neutral: "bg-surface-2 text-muted-fg",
  warning: "bg-warning-subtle text-warning",
};

/** Vertical event list with a connecting rail. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-5", className)}>
      <span aria-hidden className="absolute bottom-2 left-[15px] top-2 w-px bg-border" />
      {items.map((item) => (
        <li key={item.id} className="relative flex gap-3">
          <span
            className={cn(
              "relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-bg [&_svg]:size-4",
              tones[item.tone ?? "neutral"],
            )}
          >
            {item.icon}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="text-sm text-fg">{item.title}</div>
            {item.meta && <div className="mt-0.5 text-xs text-muted-fg">{item.meta}</div>}
            {item.children && <div className="mt-2">{item.children}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
