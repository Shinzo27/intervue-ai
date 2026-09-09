import type { BackendClient } from '../backend/client.js';
import type { LlmProvider, EvaluationResult } from '../llm/provider.js';

/**
 * Two-model scoring orchestrator — see scoring.service.ts for the flow.
 * Shared types + helpers live here to keep files small.
 */

export interface ScoreOutcome {
  ok: boolean;
  answerId: string;
  applicationId: string;
  questionVersionId: string;
  overallScore: number | null;
  maxScore: number | null;
  needsHumanReview: boolean;
  modelResults: {
    provider: string;
    model: string;
    evaluationId: string;
    status: 'COMPLETED' | 'FAILED';
    overallScore?: number;
    error?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  }[];
  aggregatedReasoning: string;
}

export interface CompletedEval {
  provider: string;
  result: EvaluationResult;
  evaluationId: string;
}

const pctOf = (e: { result: EvaluationResult }): number =>
  e.result.maxScore > 0
    ? (e.result.overallScore / e.result.maxScore) * 100
    : 0;

/**
 * Merge two providers' criterion scores: average per criterion where both
 * scored the same criterion id; reasoning tagged with the provider name.
 */
export function mergeCriteria(
  a: EvaluationResult['criteria'],
  b: EvaluationResult['criteria'],
  aName: string,
  bName: string,
): EvaluationResult['criteria'] {
  const byId = new Map(a.map((c) => [c.rubricCriterionVersionId, { ...c }]));
  for (const c of b) {
    const existing = byId.get(c.rubricCriterionVersionId);
    if (existing) {
      existing.score = (existing.score + c.score) / 2;
      existing.reasoning = `[${aName}] ${existing.reasoning} [${bName}] ${c.reasoning}`;
    } else {
      byId.set(c.rubricCriterionVersionId, { ...c });
    }
  }
  return [...byId.values()];
}

export { pctOf };
