/**
 * LLM evaluation contract + provider registry.
 *
 * Every provider returns the SAME structured evaluation, validated by Zod.
 * Providers are replaceable: `fake` (deterministic tests), `openai`
 * (strict JSON-schema), `groq` (JSON mode). Two-model scoring runs the same
 * prompt on two different providers and aggregates.
 */
import { z } from 'zod';

/** Structured per-criterion score returned by every provider. */
export interface CriterionAssessment {
  rubricCriterionVersionId: string;
  name: string;
  score: number;
  maxScore: number;
  reasoning: string;
}

/** The complete evaluation result contract (Zod-validated at runtime). */
export const EvaluationResultSchema = z.object({
  criteria: z.array(
    z.object({
      rubricCriterionVersionId: z.string().min(1),
      name: z.string(),
      score: z.number().min(0),
      // A question may legitimately have no rubric criteria; in that case a
      // provider returns maxScore 0. Rejecting that produced cryptic schema
      // failures instead of a clear "unscorable question" outcome.
      maxScore: z.number().int().min(0),
      reasoning: z.string().min(1),
    }),
  ),
  overallScore: z.number().min(0),
  maxScore: z.number().int().min(0),
  reasoning: z.string().min(1),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

/** Usage/cost metadata persisted on the AIEvaluation row. */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface EvaluationRequest {
  question: string;
  questionType: string;
  options: { id: string; text: string; order: number }[];
  rubricCriteria: {
    id: string;
    name: string;
    description: string | null;
    maxScore: number;
  }[];
  answerType: string;
  answerContent: string;
}

export interface EvaluationResponse {
  result: EvaluationResult;
  usage: TokenUsage;
  model: string;
  provider: string;
}

/** All providers implement this single method. */
export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
}

/** Shared prompt: same for every provider, so results are comparable. */
export function buildEvaluationPrompt(req: EvaluationRequest): string {
  const criteria = req.rubricCriteria
    .map((c) => `- id: ${c.id}\n  name: ${c.name} (max ${c.maxScore})`)
    .join('\n');
  const options = req.options.length
    ? `\nOptions:\n${req.options.map((o) => `- ${o.text}`).join('\n')}`
    : '';
  const typeLine =
    req.questionType === 'MCQ'
      ? 'The answer should restate/justify the chosen option(s).'
      : 'The answer is free text.';

  return `You are a strict, fair interview answer evaluator.

QUESTION (${req.questionType}): ${req.question}${options}

CANDIDATE ANSWER (${req.answerType}):
${req.answerContent}

RUBRIC CRITERIA (score each independently):
${criteria}

RULES:
1. Score every criterion against the answer using only the rubric.
2. "maxScore" is the maximum for that criterion; never exceed it.
3. overallScore = sum of criterion scores; maxScore = sum of criterion maxScores.
4. If the answer is empty or unrelated, give the minimum defensible score and say why.
5. Reasoning must be concrete and cite evidence from the answer.

${typeLine}

Respond with ONLY a JSON object matching:
{"criteria":[{"rubricCriterionVersionId":"<id from the list>","name":"<criterion name>","score":0,"maxScore":<its max>,"reasoning":"<short evidence-based reasoning>"}],"overallScore":0,"maxScore":0,"reasoning":"<overall summary>"}`;
}

/** Deterministic fake for tests/offline dev: hash-seeded rubric scores. */
export function createFakeProvider(model = 'fake-evaluator'): LlmProvider {
  const hash = (s: string): number => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
      h = (h * 33) ^ s.charCodeAt(i);
    }
    return Math.abs(h >>> 0);
  };

  return {
    name: 'fake',
    model,
    async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
      const content = request.answerContent || '(empty)';
      const criteria = request.rubricCriteria.map((c) => {
        const ratio = 0.4 + (hash(`${c.id}:${content}`) % 55) / 100; // 0.40–0.95
        const score =
          c.maxScore === 1 ? 1 : Math.min(c.maxScore, Math.round(c.maxScore * ratio));
        return {
          rubricCriterionVersionId: c.id,
          name: c.name,
          score,
          maxScore: c.maxScore,
          reasoning: `Deterministic hash-seeded score for "${c.name}" (offline fake provider).`,
        };
      });

      return {
        result: {
          criteria,
          overallScore: criteria.reduce((s, c) => s + c.score, 0),
          maxScore: criteria.reduce((s, c) => s + c.maxScore, 0),
          reasoning: 'Offline deterministic evaluation (fake provider).',
        },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model,
        provider: 'fake',
      };
    },
  };
}
