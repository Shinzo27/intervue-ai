import type { LlmEnv } from '../config/env.js';
import type { LlmProvider } from './provider.js';
import { createFakeProvider } from './provider.js';
import { createOpenAiProvider } from './openai-provider.js';
import { createGroqProvider } from './groq-provider.js';

/** Primary provider from env (fake | openai | groq). */
export function buildPrimaryProvider(env: LlmEnv): LlmProvider {
  switch (env.LLM_PROVIDER) {
    case 'openai':
      return createOpenAiProvider(env.OPENAI_API_KEY as string, env.OPENAI_MODEL);
    case 'groq':
      return createGroqProvider(env.GROQ_API_KEY as string, env.GROQ_MODEL);
    default:
      return createFakeProvider();
  }
}

/** Secondary provider for two-model scoring, or null when disabled. */
export function buildSecondaryProvider(env: LlmEnv): LlmProvider | null {
  switch (env.LLM_SECONDARY_PROVIDER) {
    case 'openai':
      return createOpenAiProvider(
        env.OPENAI_API_KEY as string,
        env.LLM_SECONDARY_MODEL ?? env.OPENAI_MODEL,
      );
    case 'groq':
      return createGroqProvider(
        env.GROQ_API_KEY as string,
        env.LLM_SECONDARY_MODEL ?? env.GROQ_MODEL,
      );
    default:
      return null;
  }
}
