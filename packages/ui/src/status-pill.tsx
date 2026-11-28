import { Badge, type BadgeProps } from "./badge";

type Tone = NonNullable<BadgeProps["variant"]>;

/** Every status the product shows, with its label and tone, in one place. */
const STATUSES: Record<string, { label: string; tone: Tone }> = {
  // Applications
  INVITED: { label: "Invited", tone: "neutral" },
  STARTED: { label: "Started", tone: "primary" },
  IN_PROGRESS: { label: "In progress", tone: "primary" },
  COMPLETED: { label: "Awaiting decision", tone: "warning" },
  DECIDED: { label: "Decided", tone: "success" },
  // Jobs and pipelines
  DRAFT: { label: "Draft", tone: "neutral" },
  PUBLISHED: { label: "Published", tone: "success" },
  CLOSED: { label: "Closed", tone: "outline" },
  ARCHIVED: { label: "Archived", tone: "outline" },
  // Decisions
  PASS: { label: "Pass", tone: "success" },
  FAIL: { label: "Fail", tone: "danger" },
  REVIEW: { label: "Needs review", tone: "warning" },
};

export function statusLabel(status: string): string {
  return STATUSES[status]?.label ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const known = STATUSES[status];
  return (
    <Badge variant={known?.tone ?? "neutral"} dot className={className}>
      {statusLabel(status)}
    </Badge>
  );
}
