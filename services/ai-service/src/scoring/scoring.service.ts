import type { BackendClient } from '../backend/client.js';
import type { LlmProvider } from '../llm/provider.js';
import {
  mergeCriteria,
  pctOf,
  type CompletedEval,
  type ScoreOutcome,
} from './types.js';

const MAX_GAP_PCT = 20; // percentage points between the two models

/**
 * Two-model scoring orchestrator.
 *
 * Flow per answer:
 *   1. Load scoring context from the backend (source of truth — the agent
 *      never accepts caller-supplied question/answer text).
 *   2. Create one PENDING AIEvaluation per model.
 *   3. Run every provider on the SAME prompt/context.
 *   4. completeEvaluation / failEvaluation per row (lifecycle-guarded).
 *   5. Aggregate: single model → direct; two models → percentage gap.
 *      gap <= 20% → average (criteria merged per-criterion), else flag
 *      needsHumanReview, write primary's score, audit the disagreement.
 *   6. Persist via transactional score upsert (criteria ownership-checked
 *      server-side).
 *
 * All state changes go through the backend internal API; this service is
 * stateless and DB-free by design.
 */
export class ScoringOrchestrator {
  constructor(
    private readonly client: BackendClient,
    private readonly primary: LlmProvider,
    private readonly secondary: LlmProvider | null,
  ) {}

  async scoreAnswer(answerId: string, traceId: string): Promise<ScoreOutcome> {
    const t0 = Date.now();
    const ctx = await this.client.getAnswerContext(answerId, traceId);

    const providers: LlmProvider[] = this.secondary
      ? [this.primary, this.secondary]
      : [this.primary];

    // A question with no rubric criteria cannot be scored meaningfully. Record
    // the attempt as FAILED with an explicit reason so the review screen shows
    // why, rather than persisting a meaningless 0/0 score row.
    if (ctx.rubricCriteria.length === 0) {
      const rows = await Promise.all(
        providers.map((p) =>
          this.client.createEvaluation(
            {
              interviewSessionId: ctx.interview.id,
              answerId,
              model: `${p.name}:${p.model}`,
            },
            traceId,
          ),
        ),
      );
      await Promise.all(
        rows.map((row) =>
          this.client
            .failEvaluation(
              row.id,
              {
                error: 'QUESTION_HAS_NO_RUBRIC: no rubric criteria defined for this question',
                result: { reason: 'no_rubric_criteria' },
              },
              traceId,
            )
            .catch(() => undefined),
        ),
      );
      return {
        ok: false,
        answerId,
        applicationId: ctx.application.id,
        questionVersionId: ctx.questionVersion.id,
        overallScore: null,
        maxScore: null,
        needsHumanReview: true,
        modelResults: providers.map((p, i) => ({
          provider: p.name,
          model: p.model,
          evaluationId: rows[i].id,
          status: 'FAILED' as const,
          error: 'QUESTION_HAS_NO_RUBRIC',
        })),
        aggregatedReasoning:
          'This question has no rubric criteria, so it cannot be scored. Add rubric criteria to the question version and re-evaluate.',
      };
    }

    // One PENDING evaluation row per model.
    const evals = await Promise.all(
      providers.map((p) =>
        this.client.createEvaluation(
          {
            interviewSessionId: ctx.interview.id,
            answerId,
            model: `${p.name}:${p.model}`,
          },
          traceId,
        ),
      ),
    );

    const modelResults: ScoreOutcome['modelResults'] = [];
    const completed: CompletedEval[] = [];

    await Promise.all(
      providers.map(async (provider, i) => {
        const evaluationId = evals[i].id;
        const latency = () => Date.now() - t0;
        try {
          const response = await provider.evaluate({
            question: ctx.questionVersion.question,
            questionType: ctx.questionVersion.type,
            options: ctx.questionVersion.options ?? [],
            rubricCriteria: ctx.rubricCriteria,
            answerType: ctx.answer.type,
            answerContent: ctx.answer.content,
          });
          await this.client.completeEvaluation(
            evaluationId,
            {
              score: response.result.overallScore,
              reasoning: response.result.reasoning,
              result: {
                criteria: response.result.criteria,
                usage: response.usage,
                latencyMs: latency(),
              },
            },
            traceId,
          );
          modelResults.push({
            provider: provider.name,
            model: response.model,
            evaluationId,
            status: 'COMPLETED',
            overallScore: response.result.overallScore,
            usage: response.usage,
          });
          completed.push({
            provider: provider.name,
            result: response.result,
            evaluationId,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await this.client
            .failEvaluation(
              evaluationId,
              { error: message, result: { latencyMs: latency() } },
              traceId,
            )
            .catch(() => undefined); // failing the row is best-effort
          modelResults.push({
            provider: provider.name,
            model: provider.model,
            evaluationId,
            status: 'FAILED',
            error: message.slice(0, 300),
          });
        }
      }),
    );

    return this.aggregate(
      ctx,
      answerId,
      modelResults,
      completed,
      traceId,
      Date.now() - t0,
    );
  }

  /** Expose the backend client (used by read-only scoring tools). */
  getBackendClient(): BackendClient {
    return this.client;
  }

  /** Persisted score rows for an application (read-only tool). */
  listApplicationScores(applicationId: string, traceId: string) {
    return this.client.listApplicationScores(applicationId, traceId);
  }

  /** Aggregate + persist + audit. Split to keep this file small. */
  private async aggregate(
    ctx: Awaited<ReturnType<BackendClient['getAnswerContext']>>,
    answerId: string,
    modelResults: ScoreOutcome['modelResults'],
    completed: CompletedEval[],
    traceId: string,
    latencyMs: number,
  ): Promise<ScoreOutcome> {
    if (completed.length === 0) {
      return {
        ok: false,
        answerId,
        applicationId: ctx.application.id,
        questionVersionId: ctx.questionVersion.id,
        overallScore: null,
        maxScore: null,
        needsHumanReview: true,
        modelResults,
        aggregatedReasoning: 'All model evaluations failed — no score written.',
      };
    }

    let chosen: { result: CompletedEval['result']; provider: string };
    let needsHumanReview = false;

    if (completed.length === 1) {
      chosen = { result: completed[0].result, provider: completed[0].provider };
    } else {
      const [a, b] = completed;
      const gap = Math.abs(pctOf(a) - pctOf(b));
      if (gap <= MAX_GAP_PCT) {
        chosen = {
          result: {
            criteria: mergeCriteria(a.result.criteria, b.result.criteria, a.provider, b.provider),
            overallScore: (a.result.overallScore + b.result.overallScore) / 2,
            maxScore: a.result.maxScore,
            reasoning: `Two-model consensus (${gap.toFixed(1)}% gap): [${a.provider}] ${a.result.overallScore}/${a.result.maxScore} vs [${b.provider}] ${b.result.overallScore}/${b.result.maxScore}. ${a.result.reasoning}`,
          },
          provider: `${a.provider}+${b.provider}`,
        };
      } else {
        needsHumanReview = true;
        chosen = { result: a.result, provider: a.provider };
      }
    }

    const score = await this.client.upsertScore(
      {
        applicationId: ctx.application.id,
        questionVersionId: ctx.questionVersion.id,
        overallScore: chosen.result.overallScore,
        maxScore: chosen.result.maxScore,
        reasoning: chosen.result.reasoning,
        criteria: chosen.result.criteria.map((c) => ({
          rubricCriterionVersionId: c.rubricCriterionVersionId,
          score: c.score,
          reasoning: c.reasoning,
        })),
      },
      traceId,
    );

    if (needsHumanReview) {
      await this.client
        .createAuditEvent(
          {
            organizationId: ctx.application.organizationId,
            actorType: 'AI',
            actorId: 'scoring-orchestrator',
            action: 'SCORING_DISAGREEMENT',
            entityType: 'Answer',
            entityId: answerId,
            metadata: {
              models: modelResults.map((m) => ({ provider: m.provider, status: m.status })),
              scores: completed.map((c) => ({
                provider: c.provider,
                overallScore: c.result.overallScore,
                maxScore: c.result.maxScore,
              })),
              thresholdPct: MAX_GAP_PCT,
              latencyMs,
            },
          },
          traceId,
        )
        .catch(() => undefined); // audit is best-effort
    }

    return {
      ok: true,
      answerId,
      applicationId: ctx.application.id,
      questionVersionId: ctx.questionVersion.id,
      overallScore: score.overallScore,
      maxScore: score.maxScore,
      needsHumanReview,
      modelResults,
      aggregatedReasoning: chosen.result.reasoning,
    };
  }
}
