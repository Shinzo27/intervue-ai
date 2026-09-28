/**
 * Permission matrix for AI-initiated actions (master-note §38, §64).
 *
 * The AI is an *actor that requests actions*, never an administrator. Every
 * Action MCP tool declares the capability it needs, and this layer decides
 * allow/reject before any backend call happens. The matrix is deliberately
 * deny-by-default: a capability that is not explicitly granted is rejected.
 *
 * Non-negotiable rule from §64 — the AI must never silently overwrite a human
 * decision. `decision:override` is therefore *structurally* ungrantable: it is
 * absent from the grant table and listed in FORBIDDEN, so no future edit that
 * merely adds a capability can accidentally hand the AI override rights.
 */

/** Capabilities an Action MCP tool can require. */
export type AiCapability =
  | 'pipeline:read'
  | 'scoring:read'
  | 'scoring:write'
  | 'interview:advance'
  | 'interview:complete'
  | 'decision:recommend'
  | 'decision:override'
  | 'review:request'
  | 'audit:write';

/** Capabilities the AI actor may never hold, under any configuration. */
export const FORBIDDEN_CAPABILITIES: readonly AiCapability[] = [
  'decision:override',
] as const;

/**
 * Capabilities the AI service holds by default. Narrow on purpose: each entry
 * is justified by a tool in the Action MCP catalog.
 */
export const AI_CAPABILITIES: readonly AiCapability[] = [
  'pipeline:read',
  'scoring:read',
  'scoring:write',
  'interview:advance',
  'interview:complete',
  'decision:recommend',
  'review:request',
  'audit:write',
] as const;

/** Who is performing the action. Recorded on every audit event. */
export type ActorType = 'AI' | 'SYSTEM';

/**
 * The acting identity carried through a tool call. Kept explicit so an
 * AI-originated action can never be logged as if a human made it.
 */
export interface ActorContext {
  actorType: ActorType;
  /** Service/agent identity, e.g. 'action-mcp', 'conversational-interviewer'. */
  actorId: string;
  /** Tool that requested the action — recorded in audit metadata. */
  tool: string;
  traceId: string;
  /**
   * Optional organization the caller claims the action is scoped to. When set,
   * the permission layer requires the resolved resource to belong to this org,
   * so a caller cannot act across a tenant boundary (§64 rule 1).
   */
  organizationIdHint?: string;
}

export interface PermissionDecision {
  allowed: boolean;
  /** Machine-readable rejection code, present when allowed === false. */
  code?: PermissionErrorCode;
  /** Human/model-readable explanation, safe to return to the calling LLM. */
  reason?: string;
}

export type PermissionErrorCode =
  | 'CAPABILITY_FORBIDDEN'
  | 'CAPABILITY_NOT_GRANTED'
  | 'ORG_MISMATCH'
  | 'RESOURCE_NOT_FOUND'
  | 'ILLEGAL_STATE';

export class PermissionDeniedError extends Error {
  readonly code: PermissionErrorCode;

  constructor(code: PermissionErrorCode, message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
    this.code = code;
  }
}

/**
 * Decide whether the AI actor may perform an action requiring `capability`.
 *
 * Checks run in a fixed order (deny-first) so the rejection reason is
 * deterministic and auditable:
 *   1. forbidden  — the capability can never be granted (§64)
 *   2. not granted — absent from the default grant table
 *   3. org scope  — the resource must belong to the expected organization
 */
export function checkPermission(input: {
  capability: AiCapability;
  actor: ActorContext;
  /**
   * Organization the action targets. When supplied it must match the org that
   * owns the resource, preventing cross-org access (§64 rule 1).
   */
  expectedOrganizationId?: string;
  /** Organization that actually owns the resolved resource. */
  resourceOrganizationId?: string;
}): PermissionDecision {
  const { capability, actor, expectedOrganizationId, resourceOrganizationId } = input;

  if (FORBIDDEN_CAPABILITIES.includes(capability)) {
    return {
      allowed: false,
      code: 'CAPABILITY_FORBIDDEN',
      reason:
        `Capability "${capability}" is permanently forbidden for AI actors. ` +
        'Human decisions can only be changed by an authorized recruiter through the ' +
        'decision-override endpoint, which always records a DecisionOverride row.',
    };
  }

  if (!AI_CAPABILITIES.includes(capability)) {
    return {
      allowed: false,
      code: 'CAPABILITY_NOT_GRANTED',
      reason: `Capability "${capability}" is not granted to the AI service.`,
    };
  }

  if (
    expectedOrganizationId !== undefined &&
    resourceOrganizationId !== undefined &&
    expectedOrganizationId !== resourceOrganizationId
  ) {
    return {
      allowed: false,
      code: 'ORG_MISMATCH',
      reason:
        'Organization boundary violation: the resource belongs to a different ' +
        'organization than the one this action is scoped to.',
    };
  }

  return { allowed: true };
}

/** Throws {@link PermissionDeniedError} when the action is not permitted. */
export function assertPermission(input: Parameters<typeof checkPermission>[0]): void {
  const decision = checkPermission(input);
  if (!decision.allowed) {
    throw new PermissionDeniedError(
      decision.code as PermissionErrorCode,
      decision.reason as string,
    );
  }
}

/**
 * Build the audit metadata every AI state change must carry (§38 "Audit log",
 * §64 rule 4): which tool acted, as whom, under which trace, and why.
 */
export function buildAuditMetadata(input: {
  actor: ActorContext;
  capability: AiCapability;
  traceId: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    tool: input.actor.tool,
    actorType: input.actor.actorType,
    actorId: input.actor.actorId,
    capability: input.capability,
    traceId: input.traceId ?? input.actor.traceId,
    ...(input.extra ?? {}),
  };
}
