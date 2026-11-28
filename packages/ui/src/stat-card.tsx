import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./lib/cn";
import { Skeleton } from "./skeleton";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** Short context under the value, e.g. "3 need a decision". */
  hint?: ReactNode;
  tone?: "neutral" | "primary" | "ai" | "success" | "warning";
  loading?: boolean;
  className?: string;
}

const tones = {
  neutral: "bg-surface-2 text-muted-fg",
  primary: "bg-primary-subtle text-primary",
  ai: "bg-ai-subtle text-ai",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
};

/** KPI tile: label, large tabular number, optional hint. */
export function StatCard({ label, value, icon: Icon, hint, tone = "neutral", loading, className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-fg">{label}</p>
        {Icon && (
          <span className={cn("grid size-8 place-items-center rounded-md", tones[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-fg">{value}</p>
      )}
      {hint && <p className="mt-1 text-[13px] text-muted-fg">{hint}</p>}
    </div>
  );
}
