import OpenAI from 'openai';
import {
  buildEvaluationPrompt,
  EvaluationResultSchema,
  type EvaluationRequest,
  type EvaluationResponse,
  type LlmProvider,
} from './provider.js';

/**
 * OpenAI adapter — structured output via strict json_schema response format,
 * so the model cannot return malformed evaluation JSON.
 */
export function createOpenAiProvider(apiKey: string, model: string): LlmProvider {
  const client = new OpenAI({ apiKey });

  return {
    name: 'openai',
    model,
    async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: buildEvaluationPrompt(request) }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'interview_answer_evaluation',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['criteria', 'overallScore', 'maxScore', 'reasoning'],
              properties: {
                criteria: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'rubricCriterionVersionId',
                      'name',
                      'score',
                      'maxScore',
                      'reasoning',
                    ],
                    properties: {
                      rubricCriterionVersionId: { type: 'string' },
                      name: { type: 'string' },
                      score: { type: 'number' },
                      maxScore: { type: 'number' },
                      reasoning: { type: 'string' },
                    },
                  },
                },
                overallScore: { type: 'number' },
                maxScore: { type: 'number' },
                reasoning: { type: 'string' },
              },
            },
          },
        },
      });

      const raw = response.choices[0]?.message?.content ?? '';
      const parsed = EvaluationResultSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        throw new Error(
          `OpenAI evaluation failed schema validation: ${parsed.error.message.slice(0, 300)}`,
        );
      }

      return {
        result: parsed.data,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
        model,
        provider: 'openai',
      };
    },
  };
}
