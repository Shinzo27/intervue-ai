import { z } from 'zod';
import type { BackendClient } from '../../backend/client.js';
import type { McpToolDefinition, ToolContext } from '../registry.js';
import {
  assertPermission,
  buildAuditMetadata,
  type ActorContext,
  type AiCapability,
} from './permissions.js';
import { computeDecision, DEFAULT_PASS_THRESHOLD_PCT } from './decision.js';

/**
 * Action MCP (master-note §37) — the controlled action layer.
 *
 * Every tool follows the mandated flow from §38:
 *   permission → organization → resource → execute → audit
 *
 * Two structural rules from §64 are enforced by construction here:
 *  - No tool in this file can mutate a human decision. `decision:override` is
 *    not requested by any tool, and the permission layer forbids it outright.
 *  - No tool mutates a published pipeline snapshot. The pipeline snapshot is
 *    read-only from this service; actions only move interview runtime state.
 *
 * Progression note: pointer movement (question → stage → interview) happens
 * inside the backend's `submitAnswer` transaction, which is the sole authority
 * for progression. `advance_interview` therefore validates and audits a
 * progression step and returns the backend's authoritative resulting position
 * — it does not re-implement progression in the AI service.
 */

/** Audit writes are best-effort: an audit outage must not fail the action. */
async function audit(
  client: BackendClient,
  ctx: ToolContext,
  input: {
    organizationId: string;
    actor: ActorContext;
    capability: AiCapability;
    action: string;
    entityType: string;
    entityId: string;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  await client
    .createAuditEvent(
      {
        organizationId: input.organizationId,
        actorType: input.actor.actorType,
        actorId: input.actor.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: buildAuditMetadata({
          actor: input.actor,
          capability: input.capability,
          traceId: ctx.traceId,
          extra: input.extra,
        }),
      },
      ctx.traceId,
    )
    .catch(() => undefined);
}

/**
 * Resolve the interview and assert organization scope before any action.
 * Shared by every tool so the org check can never be forgotten.
 */
async function resolveScopedInterview(
  client: BackendClient,
  interviewId: string,
  ctx: ToolContext,
  actor: ActorContext,
  capability: AiCapability,
) {
  const state = await client.getInterviewState(interviewId, ctx.traceId);

  // Organization validation: the caller may pin an expected org; when it does,
  // the interview's owning organization must match (deny cross-org access).
  assertPermission({
    capability,
    actor,
    expectedOrganizationId: actor.organizationIdHint,
    resourceOrganizationId: state.application.organizationId,
  });

  return state;
}

export function buildActionTools(client: BackendClient): McpToolDefinition[] {
  return [
    {
      name: 'advance_interview',
      description:
        'Validate and audit progression of an in-progress interview, returning the ' +
        'backend-authoritative current position (stage, question, progress). Use after ' +
        'an answer has been submitted and scored to learn what the candidate should be ' +
        'asked next. Rejects interviews that are not IN_PROGRESS. Progression itself is ' +
        'performed transactionally by the backend when an answer is submitted.',
      inputSchema: {
        interviewId: z.string().uuid().describe('Interview session id (UUID)'),
        expectedOrganizationId: z
          .string()
          .min(1)
          .optional()
          .describe('Pin the org scope; rejected if the interview belongs to another org'),
      },
      permissions: ['interview:advance'],
      readOnly: false,
      handler: async (input: Record<string, unknown>, ctx) => {
        const interviewId = input.interviewId as string;
        const actor = actorFrom(ctx, 'advance_interview', input.expectedOrganizationId as string | undefined);

        const state = await resolveScopedInterview(
          client,
          interviewId,
          ctx,
          actor,
          'interview:advance',
        );

        // Resource validation: only an active interview may be advanced.
        if (state.interview.status !== 'IN_PROGRESS') {
          throw new Error(
            `Interview ${interviewId} cannot be advanced from status ` +
              `"${state.interview.status}" — only IN_PROGRESS interviews advance.`,
          );
        }

        await audit(client, ctx, {
          organizationId: state.application.organizationId,
          actor,
          capability: 'interview:advance',
          action: 'INTERVIEW_ADVANCED',
          entityType: 'InterviewSession',
          entityId: interviewId,
          extra: {
            stageId: state.stage?.id ?? null,
            questionVersionId: state.question?.id ?? null,
            progress: state.progress,
          },
        });

        return {
          interviewId,
          status: state.interview.status,
          applicationId: state.application.id,
          organizationId: state.application.organizationId,
          currentStage: state.stage,
          currentQuestion: state.question,
          progress: state.progress,
          interviewComplete: state.question === null && state.stage === null,
        };
      },
    },
    {
      name: 'complete_interview',
      description:
        'Mark an interview session and its application as COMPLETED. Idempotent: ' +
        'completing an already-completed interview succeeds and reports ' +
        'alreadyCompleted=true rather than erroring. Rejects interviews that never ' +
        'started. Use when the candidate finishes the final question.',
      inputSchema: {
        interviewId: z.string().uuid().describe('Interview session id (UUID)'),
        expectedOrganizationId: z
          .string()
          .min(1)
          .optional()
          .describe('Pin the org scope; rejected if the interview belongs to another org'),
      },
      permissions: ['interview:complete'],
      readOnly: false,
      handler: async (input: Record<string, unknown>, ctx) => {
        const interviewId = input.interviewId as string;
        const actor = actorFrom(ctx, 'complete_interview', input.expectedOrganizationId as string | undefined);

        const state = await resolveScopedInterview(
          client,
          interviewId,
          ctx,
          actor,
          'interview:complete',
        );

        // The backend owns the state machine and will reject illegal transitions;
        // this pre-check just produces a clearer error for the calling agent.
        if (
          state.interview.status !== 'IN_PROGRESS' &&
          state.interview.status !== 'COMPLETED'
        ) {
          throw new Error(
            `Interview ${interviewId} cannot be completed from status ` +
              `"${state.interview.status}".`,
          );
        }

        const result = await client.completeInterview(interviewId, ctx.traceId);

        await audit(client, ctx, {
          organizationId: state.application.organizationId,
          actor,
          capability: 'interview:complete',
          action: 'INTERVIEW_COMPLETED',
          entityType: 'InterviewSession',
          entityId: interviewId,
          extra: { alreadyCompleted: result.alreadyCompleted },
        });

        return result;
      },
    },
    {
      name: 'create_decision',
      description:
        'Create the application decision from persisted question scores. Aggregates ' +
        'the application score, compares it against a pass threshold (default ' +
        `${DEFAULT_PASS_THRESHOLD_PCT}%), and persists the resulting PASS/FAIL ` +
        'recommendation. This writes the AI recommendation only — it can never change ' +
        'an existing decision, and a human override is recorded separately as a ' +
        'DecisionOverride. Rejects if a decision already exists.',
      inputSchema: {
        applicationId: z.string().uuid().describe('Application id (UUID)'),
        thresholdPct: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe(`Pass threshold as a percentage (default ${DEFAULT_PASS_THRESHOLD_PCT})`),
        reasoning: z
          .string()
          .optional()
          .describe('Extra narrative appended to the threshold-derived reasoning'),
      },
      permissions: ['decision:recommend'],
      readOnly: false,
      handler: async (input: Record<string, unknown>, ctx) => {
        const applicationId = input.applicationId as string;
        const actor = actorFrom(ctx, 'create_decision');

        // Organization validation via the application's own score summary.
        const summary = await client.getScoreSummary(applicationId, ctx.traceId);

        assertPermission({
          capability: 'decision:recommend',
          actor,
          expectedOrganizationId: actor.organizationIdHint,
          resourceOrganizationId: readOrgFromSummary(summary),
        });

        const thresholdPct = input.thresholdPct as number | undefined;
        const computed = computeDecision({
          totalScore: summary.totalScore,
          maxScore: summary.maxScore,
          thresholdPct,
        });

        const reasoning = [computed.reasoning, input.reasoning as string | undefined]
          .filter(Boolean)
          .join(' ');

        const decision = await client.createDecision(
          applicationId,
          {
            outcome: computed.outcome,
            totalScore: Math.round(summary.totalScore),
            maxScore: Math.round(summary.maxScore),
            reasoning,
            requestedBy: actor.actorId,
          },
          ctx.traceId,
        );

        await audit(client, ctx, {
          organizationId: readOrgFromSummary(summary),
          actor,
          capability: 'decision:recommend',
          action: 'DECISION_RECOMMENDED',
          entityType: 'Decision',
          entityId: String((decision as { id?: string }).id ?? applicationId),
          extra: {
            outcome: computed.outcome,
            percentage: computed.percentage,
            thresholdPct: computed.thresholdPct,
            unscored: computed.unscored,
          },
        });

        return {
          decision,
          recommendation: computed,
        };
      },
    },
    {
      name: 'request_human_review',
      description:
        'Flag an application for recruiter review — used when the two scoring models ' +
        'disagree or an evaluation fails. Records an auditable HUMAN_REVIEW_REQUESTED ' +
        'event; review flags are persisted in the audit log (no mutable flag column), ' +
        'so a recruiter surfaces them by querying audit events for this organization.',
      inputSchema: {
        applicationId: z.string().uuid().describe('Application id (UUID)'),
        reason: z
          .string()
          .min(1)
          .describe('Why human review is needed (e.g. model disagreement details)'),
        entityType: z
          .string()
          .optional()
          .describe('Entity the flag concerns (default: Application)'),
        entityId: z
          .string()
          .optional()
          .describe('Entity id the flag concerns (default: the applicationId)'),
      },
      permissions: ['review:request'],
      readOnly: false,
      handler: async (input: Record<string, unknown>, ctx) => {
        const applicationId = input.applicationId as string;
        const actor = actorFrom(ctx, 'request_human_review');

        const summary = await client.getScoreSummary(applicationId, ctx.traceId);
        const organizationId = readOrgFromSummary(summary);

        assertPermission({
          capability: 'review:request',
          actor,
          expectedOrganizationId: actor.organizationIdHint,
          resourceOrganizationId: organizationId,
        });

        const event = await client.createAuditEvent(
          {
            organizationId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            action: 'HUMAN_REVIEW_REQUESTED',
            entityType: (input.entityType as string | undefined) ?? 'Application',
            entityId: (input.entityId as string | undefined) ?? applicationId,
            metadata: buildAuditMetadata({
              actor,
              capability: 'review:request',
              traceId: ctx.traceId,
              extra: {
                applicationId,
                reason: input.reason,
                persistence: 'audit_log',
              },
            }),
          },
          ctx.traceId,
        );

        return {
          requested: true,
          auditEventId: (event as { id?: string }).id ?? null,
          applicationId,
          organizationId,
          reason: input.reason,
        };
      },
    },
    {
      name: 'create_audit_event',
      description:
        'Append an AI-attributed audit record. Required for any AI state change that is ' +
        'not already audited by its originating tool. Metadata automatically records the ' +
        'tool, actor, capability and trace id.',
      inputSchema: {
        organizationId: z.string().min(1).describe('Organization id'),
        action: z.string().min(1).describe('Action name, e.g. INTERVIEW_STARTED'),
        entityType: z.string().min(1).describe('Entity type, e.g. InterviewSession'),
        entityId: z.string().min(1).describe('Entity id'),
        metadata: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Additional metadata (tool/actor/trace are merged in)'),
      },
      permissions: ['audit:write'],
      readOnly: false,
      handler: async (input: Record<string, unknown>, ctx) => {
        const actor = actorFrom(ctx, 'create_audit_event');

        assertPermission({ capability: 'audit:write', actor });

        return client.createAuditEvent(
          {
            organizationId: input.organizationId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            metadata: buildAuditMetadata({
              actor,
              capability: 'audit:write',
              traceId: ctx.traceId,
              extra: input.metadata as Record<string, unknown> | undefined,
            }),
          },
          ctx.traceId,
        );
      },
    },
  ];
}

/**
 * Build the acting identity for a tool call. Always AI-typed: an action taken
 * through this service is never logged as a human action (§64 rule 3).
 */
function actorFrom(
  ctx: ToolContext,
  tool: string,
  organizationIdHint?: string,
): ActorContext {
  return {
    actorType: 'AI',
    actorId: 'ai-service',
    tool,
    traceId: ctx.traceId,
    organizationIdHint,
  };
}

/**
 * Organization the resource belongs to, read from the score summary.
 *
 * Both action tools that operate on an applicationId go through here, so org
 * validation is never skipped. The backend returns `organizationId` on the
 * summary precisely so this check cannot silently no-op.
 */
function readOrgFromSummary(summary: unknown): string {
  const org = (summary as { organizationId?: string } | null)?.organizationId;
  if (!org) {
    throw new Error(
      'Score summary did not include organizationId — refusing to perform an ' +
        'org-scoped action without a verifiable organization boundary.',
    );
  }
  return org;
}
