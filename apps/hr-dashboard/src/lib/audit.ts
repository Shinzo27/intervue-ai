export interface AuditEvent {
  id: string;
  actorType: "USER" | "AI" | "SYSTEM";
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** "interview.answer_evaluated" -> "Interview answer evaluated". */
export function humanizeAction(action: string): string {
  const text = action.replace(/[._:]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
