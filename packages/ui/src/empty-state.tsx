import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./lib/cn";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-muted-fg">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="max-w-sm space-y-1">
        <p className="text-base font-semibold text-fg">{title}</p>
        {description && <p className="text-sm text-muted-fg">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
