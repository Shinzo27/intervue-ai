import { cn } from "./lib/cn";

export type ScoreTone = "success" | "primary" | "warning" | "danger";

/** Band a 0–100 percentage into a label and tone. Never rely on colour alone. */
export function scoreBand(percent: number): { label: string; tone: ScoreTone } {
  if (percent >= 80) return { label: "Strong", tone: "success" };
  if (percent >= 65) return { label: "Good", tone: "primary" };
  if (percent >= 50) return { label: "Mixed", tone: "warning" };
  return { label: "Weak", tone: "danger" };
}

const barTone: Record<ScoreTone, string> = {
  success: "bg-success",
  primary: "bg-primary",
  warning: "bg-warning",
  danger: "bg-danger",
};
const textTone: Record<ScoreTone, string> = {
  success: "text-success",
  primary: "text-primary",
  warning: "text-warning",
  danger: "text-danger",
};

function percentOf(score: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (score / max) * 100)) : 0;
}

interface ScoreBarProps {
  label: string;
  score: number;
  max: number;
  /** Show the band label (Strong / Good / Mixed / Weak). */
  showBand?: boolean;
  className?: string;
}

/** Number + bar + optional band label for one criterion or question. */
export function ScoreBar({ label, score, max, showBand = false, className }: ScoreBarProps) {
  const percent = percentOf(score, max);
  const band = scoreBand(percent);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-fg">{label}</span>
        <span className="tabular shrink-0 font-mono text-[13px] text-muted-fg">
          {showBand && <span className={cn("mr-2 font-sans font-medium", textTone[band.tone])}>{band.label}</span>}
          {score}/{max}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={score}
        aria-valuetext={`${score} of ${max}`}
        className="h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", barTone[band.tone])}
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
    </div>
  );
}

interface ScoreRingProps {
  /** 0–100. */
  percent: number;
  size?: number;
  label?: string;
  className?: string;
}

/** Circular overall score with the percentage and band in the middle. */
export function ScoreRing({ percent, size = 112, label = "Overall score", className }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const band = scoreBand(clamped);
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-valuetext={`${clamped}%, ${band.label}`}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-surface-2" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", {
            "stroke-success": band.tone === "success",
            "stroke-primary": band.tone === "primary",
            "stroke-warning": band.tone === "warning",
            "stroke-danger": band.tone === "danger",
          })}
        />
      </svg>
      <span className="absolute text-center">
        <span className="tabular block text-2xl font-semibold leading-none text-fg">{clamped}%</span>
        <span className={cn("mt-1 block text-xs font-medium", textTone[band.tone])}>{band.label}</span>
      </span>
    </div>
  );
}
