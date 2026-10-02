import type { LlmEnv } from '../config/env.js';
import type { ChatProvider } from './chat.js';
import { createFakeChatProvider } from './chat.js';
import { createOpenAiChatProvider } from './openai-chat-provider.js';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Chat provider selection for the interviewer agent.
 *
 * Reuses the same env contract as scoring (LLM_PROVIDER + the matching key), so
 * there is no second place to configure the model. `fake` keeps the full
 * conversation loop runnable offline.
 */
export function buildChatProvider(env: LlmEnv): ChatProvider {
  switch (env.LLM_PROVIDER) {
    case 'openai':
      return createOpenAiChatProvider(env.OPENAI_API_KEY as string, env.OPENAI_MODEL);
    case 'groq':
      return createOpenAiChatProvider(
        env.GROQ_API_KEY as string,
        env.GROQ_MODEL,
        GROQ_BASE_URL,
      );
    default:
      return createFakeChatProvider();
  }
}