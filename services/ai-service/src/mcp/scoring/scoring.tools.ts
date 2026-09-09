import { z } from 'zod';
import type { ScoringOrchestrator } from '../../scoring/scoring.service.js';
import type { McpToolDefinition } from '../registry.js';

/**
 * Scoring MCP — evaluation tools backed by the two-model orchestrator.
 * `evaluate_answer` is the core scoring loop; `get_application_scores`
 * exposes the persisted score rows for review/decision flows.
 */
export function buildScoringTools(orchestrator: ScoringOrchestrator): McpToolDefinition[] {
  return [
    {
      name: 'evaluate_answer',
      description:
        'Evaluate a candidate answer against its rubric using two independent LLM models. ' +
        'Loads the frozen question + rubric + answer from the backend (source of truth), runs ' +
        'both models, persists AIEvaluation rows + the final Score with criterion breakdown. ' +
        'Returns scores, per-model results, and needsHumanReview when models disagree.',
      inputSchema: {
        answerId: z.string().uuid().describe('Answer id (UUID)'),
      },
      permissions: ['scoring:write'],
      readOnly: false,
      handler: async (input: Record<string, unknown>, ctx) =>
        orchestrator.scoreAnswer(input.answerId as string, ctx.traceId),
    },
    {
      name: 'get_application_scores',
      description:
        'List all persisted question scores (with criterion breakdowns) for an application. ' +
        'Use to review scoring state or to prepare a hiring decision.',
      inputSchema: {
        applicationId: z.string().uuid().describe('Application id (UUID)'),
      },
      permissions: ['scoring:read'],
      readOnly: true,
      handler: async (input: Record<string, unknown>, ctx) =>
        orchestrator.listApplicationScores(input.applicationId as string, ctx.traceId),
    },
  ];
}
