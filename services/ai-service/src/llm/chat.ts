/**
 * Conversational chat contract for the interviewer agent.
 *
 * Deliberately separate from the scoring `LlmProvider`: that one is a single
 * structured-output `evaluate()` call, while this one needs multi-turn message
 * history and an optional streaming path for SSE. Two shapes, two interfaces —
 * forcing them together would contort both.
 *
 * `fake` implements the same contract deterministically so the whole
 * conversation loop is testable offline with no API key (§8 resilience).
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Cap output length; interviewers are told to be concise. */
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
}

export interface ChatProvider {
  readonly name: string;
  readonly model: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}

/**
 * Deterministic offline interviewer.
 *
 * Never fabricates a question of its own: it extracts the question fenced in
 * the system prompt (`<question>…</question>`) and relays it. That mirrors the
 * real model's most important constraint, so the fallback path is exercised
 * honestly by the e2e tests rather than being a stub that always "passes".
 */
export function createFakeChatProvider(model = 'fake-interviewer'): ChatProvider {
  return {
    name: 'fake',
    model,
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const system = request.messages.find((m) => m.role === 'system')?.content ?? '';
      const fenced = /<question>\s*([\s\S]*?)\s*<\/question>/.exec(system);
      const userTurns = request.messages.filter((m) => m.role === 'user').length;

      if (!fenced) {
        return {
          content:
            'Thank you for completing the interview. Your answers have been recorded and a recruiter will be in touch.',
          model,
          provider: 'fake',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
        };
      }

      const question = fenced[1];
      const content =
        userTurns === 0
          ? `Thanks for joining us. ${question}`
          : `Great, thank you. ${question}`;

      return {
        content,
        model,
        provider: 'fake',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      };
    },
  };
}