import OpenAI from 'openai';
import type { ChatProvider, ChatRequest, ChatResponse } from './chat.js';

/**
 * OpenAI-compatible chat adapter for the interviewer agent.
 *
 * The scoring provider pins `temperature` implicitly through strict structured
 * output; chat needs an explicit low temperature and a token cap so a verbose
 * model cannot blow past the "two sentences" rule.
 *
 * `baseURL` is parameterised because Groq speaks the same wire format against a
 * different host — passing a Groq key to api.openai.com would simply 401, so
 * the two must never be conflated.
 */
export function createOpenAiChatProvider(
  apiKey: string,
  model: string,
  baseURL?: string,
): ChatProvider {
  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
  const providerName = baseURL?.includes('groq') ? 'groq' : 'openai';

  return {
    name: providerName,
    model,
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const response = await client.chat.completions.create({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 300,
      });

      const choice = response.choices[0];
      const content = choice?.message?.content ?? '';

      return {
        content: content.trim(),
        model,
        provider: providerName,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
        finishReason: choice?.finish_reason ?? undefined,
      };
    },
  };
}