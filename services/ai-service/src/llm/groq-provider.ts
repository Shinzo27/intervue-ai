import OpenAI from 'openai';
import {
  buildEvaluationPrompt,
  EvaluationResultSchema,
  type EvaluationRequest,
  type EvaluationResponse,
  type LlmProvider,
} from './provider.js';

/**
 * Groq adapter — OpenAI-compatible wire format with JSON mode. Response is
 * validated with the same Zod contract as every other provider.
 */
export function createGroqProvider(apiKey: string, model: string): LlmProvider {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  return {
    name: 'groq',
    model,
    async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You output only valid JSON matching the requested schema. No prose.',
          },
          { role: 'user', content: buildEvaluationPrompt(request) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const raw = response.choices[0]?.message?.content ?? '';
      const parsed = EvaluationResultSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        throw new Error(
          `Groq evaluation failed schema validation: ${parsed.error.message.slice(0, 300)}`,
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
        provider: 'groq',
      };
    },
  };
}
