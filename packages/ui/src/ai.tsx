import type { ReactNode } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "./lib/cn";
import { Badge } from "./badge";

/** Violet marker for anything the AI authored (a message, score or decision). */
export function AIMarker({ label = "AI", className }: { label?: string; className?: string }) {
  return (
    <Badge variant="ai" className={className}>
      <Sparkles aria-hidden /> {label}
    </Badge>
  );
}

/** Models disagreed beyond the consensus threshold; a human should look. */
export function DisagreementBadge({ gap, className }: { gap?: number; className?: string }) {
  return (
    <Badge variant="warning" className={className}>
      <AlertTriangle aria-hidden /> Models disagree{gap !== undefined ? ` by ${Math.round(gap)} pts` : ""}
    </Badge>
  );
}

export interface ModelRun {
  id: string;
  model: string;
  status: string;
  /** Score on the question's own scale, or null when the run failed. */
  score: number | null;
  reasoning?: string | null;
}

interface ModelComparisonProps {
  runs: ModelRun[];
  max: number;
  /** Percentage-point gap above which the models are said to disagree. */
  threshold?: number;
  className?: string;
}

/** Side-by-side scores from each model for one answer, with a disagreement flag. */
export function ModelComparison({ runs, max, threshold = 20, className }: ModelComparisonProps) {
  const completed = runs.filter((r) => r.status === "COMPLETED" && r.score !== null);
  const percents = completed.map((r) => (max > 0 ? ((r.score as number) / max) * 100 : 0));
  const gap = percents.length > 1 ? Math.max(...percents) - Math.min(...percents) : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Model evaluations</span>
        {gap !== null &&
          (gap > threshold ? (
            <DisagreementBadge gap={gap} />
          ) : (
            <Badge variant="success">Models agree</Badge>
          ))}
        {gap === null && completed.length === 1 && <Badge>Single model</Badge>}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {runs.map((run) => (
          <li key={run.id} className="rounded-md border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-xs text-muted-fg">{run.model}</span>
              {run.status === "COMPLETED" && run.score !== null ? (
                <span className="tabular font-mono text-sm font-semibold text-fg">
                  {run.score}/{max}
                </span>
              ) : (
                <Badge variant="danger">{run.status === "FAILED" ? "Failed" : run.status.toLowerCase()}</Badge>
              )}
            </div>
            {run.reasoning && <p className="mt-1.5 text-[13px] leading-5 text-muted-fg">{run.reasoning}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small block of AI-written prose (reasoning, summaries), visibly attributed to the AI. */
export function AINote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-2.5 rounded-md border-l-2 border-ai bg-ai-subtle px-3 py-2 text-[13px] leading-5 text-fg", className)}>
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-ai" aria-label="AI" />
      <div>{children}</div>
    </div>
  );
}
