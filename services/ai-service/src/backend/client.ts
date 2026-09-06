import { randomUUID } from 'node:crypto';
import type {
  AIEvaluation,
  AuditEvent,
  CurrentQuestion,
  InterviewProgress,
  InterviewState,
  Message,
  QuestionDetails,
  Score,
  ScoreSummary,
  StageQuestions,
  Transcript,
} from './types.js';

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly traceId?: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

export interface BackendClientOptions {
  baseUrl: string;
  token: string;
  /** Total attempts for idempotent requests. */
  maxRetries?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Typed service-to-service HTTP client for the backend internal API.
 *
 * - Authorization: `Internal <token>`
 * - Propagates `x-trace-id` on every request (echoed by the backend logger)
 * - Retries idempotent requests on 5xx/network errors with exponential backoff
 * - Typed errors: BackendError with status + trace-id, never silent
 */
export class BackendClient {
  /** Trace id of the most recent request (for logging/correlation). */
  lastTraceId: string | undefined;

  private readonly baseUrl: string;
  private readonly token: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BackendClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = `Internal ${options.token}`;
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T = Record<string, unknown>>(
    method: string,
    path: string,
    options: { body?: unknown; traceId?: string } = {},
  ): Promise<T> {
    const traceId = options.traceId ?? randomUUID();
    const url = `${this.baseUrl}${path}`;
    const idempotent = method !== 'POST';
    const maxAttempts = idempotent ? this.maxRetries : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.token,
            'x-trace-id': traceId,
          },
          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(options.body),
          signal: controller.signal,
        });

        const text = await response.text();
        let payload: unknown = undefined;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = { raw: text };
          }
        }

        if (!response.ok) {
          const message =
            (payload as { message?: string })?.message ??
            `Backend responded ${response.status}`;
          const error = new BackendError(message, response.status, traceId);
          this.lastTraceId = traceId;

          if (response.status >= 500 && attempt < maxAttempts) {
            await this.backoff(attempt);
            continue;
          }
          throw error;
        }

        this.lastTraceId = traceId;
        return payload as T;
      } catch (error) {
        if (error instanceof BackendError) {
          throw error;
        }

        // Network / timeout / abort errors: retry only idempotent requests.
        if (idempotent && attempt < maxAttempts) {
          await this.backoff(attempt);
          continue;
        }

        this.lastTraceId = traceId;
        throw new BackendError(
          `Backend request failed: ${(error as Error).message}`,
          0,
          traceId,
          error,
        );
      } finally {
        clearTimeout(timer);
      }
    }

    // Unreachable: every loop iteration either returns or throws.
    throw new BackendError('Backend request failed after retries', 0, traceId);
  }

  private backoff(attempt: number): Promise<void> {
    const delay = Math.min(250 * 2 ** (attempt - 1), 2000);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  // ------------------------------------------------------------ typed API

  getInterviewState(interviewId: string, traceId?: string) {
    return this.request<InterviewState>(
      'GET',
      `/interviews/${encodeURIComponent(interviewId)}/state`,
      { traceId },
    );
  }

  getCurrentQuestion(interviewId: string, traceId?: string) {
    return this.request<CurrentQuestion>(
      'GET',
      `/interviews/${encodeURIComponent(interviewId)}/current-question`,
      { traceId },
    );
  }

  getStageQuestions(
    interviewId: string,
    stageVersionId: string,
    traceId?: string,
  ) {
    return this.request<StageQuestions>(
      'GET',
      `/interviews/${encodeURIComponent(interviewId)}/stages/${encodeURIComponent(stageVersionId)}/questions`,
      { traceId },
    );
  }

  getQuestionDetails(
    interviewId: string,
    questionVersionId: string,
    traceId?: string,
  ) {
    return this.request<QuestionDetails>(
      'GET',
      `/interviews/${encodeURIComponent(interviewId)}/questions/${encodeURIComponent(questionVersionId)}`,
      { traceId },
    );
  }

  getInterviewProgress(interviewId: string, traceId?: string) {
    return this.request<InterviewProgress>(
      'GET',
      `/interviews/${encodeURIComponent(interviewId)}/progress`,
      { traceId },
    );
  }

  getTranscript(interviewId: string, traceId?: string) {
    return this.request<Transcript>(
      'GET',
      `/interviews/${encodeURIComponent(interviewId)}/transcript`,
      { traceId },
    );
  }

  appendMessage(
    interviewId: string,
    dto: {
      role: 'CANDIDATE' | 'ASSISTANT';
      content: string;
      metadata?: Record<string, unknown>;
    },
    traceId?: string,
  ) {
    return this.request<Message>(
      'POST',
      `/interviews/${encodeURIComponent(interviewId)}/messages`,
      { body: dto, traceId },
    );
  }

  createEvaluation(
    dto: { interviewSessionId: string; answerId: string; model?: string },
    traceId?: string,
  ) {
    return this.request<AIEvaluation>('POST', '/evaluations', {
      body: dto,
      traceId,
    });
  }

  completeEvaluation(
    id: string,
    dto: { score: number; reasoning?: string; result?: unknown },
    traceId?: string,
  ) {
    return this.request<AIEvaluation>(
      'PATCH',
      `/evaluations/${encodeURIComponent(id)}/complete`,
      { body: dto, traceId },
    );
  }

  failEvaluation(
    id: string,
    dto: { error?: string; result?: unknown },
    traceId?: string,
  ) {
    return this.request<AIEvaluation>(
      'PATCH',
      `/evaluations/${encodeURIComponent(id)}/fail`,
      { body: dto, traceId },
    );
  }

  upsertScore(
    dto: {
      applicationId: string;
      questionVersionId: string;
      overallScore: number;
      maxScore: number;
      reasoning?: string;
      criteria?: {
        rubricCriterionVersionId: string;
        score: number;
        reasoning?: string;
      }[];
    },
    traceId?: string,
  ) {
    return this.request<Score>('POST', '/scores', { body: dto, traceId });
  }

  getScoreSummary(applicationId: string, traceId?: string) {
    return this.request<ScoreSummary>(
      'GET',
      `/applications/${encodeURIComponent(applicationId)}/score-summary`,
      { traceId },
    );
  }

  completeInterview(interviewId: string, traceId?: string) {
    return this.request<{
      interviewId: string;
      status: string;
      alreadyCompleted: boolean;
    }>('POST', `/interviews/${encodeURIComponent(interviewId)}/complete`, {
      traceId,
    });
  }

  createDecision(
    applicationId: string,
    dto: {
      outcome: 'PASS' | 'FAIL';
      totalScore: number;
      maxScore: number;
      reasoning?: string;
      requestedBy?: string;
    },
    traceId?: string,
  ) {
    return this.request(
      'POST',
      `/applications/${encodeURIComponent(applicationId)}/decision`,
      { body: dto, traceId },
    );
  }

  createAuditEvent(dto: Record<string, unknown>, traceId?: string) {
    return this.request<AuditEvent>('POST', '/audit-events', {
      body: dto,
      traceId,
    });
  }

  listAuditEvents(organizationId: string, limit = 100, traceId?: string) {
    return this.request<AuditEvent[]>(
      'GET',
      `/audit/${encodeURIComponent(organizationId)}?limit=${limit}`,
      { traceId },
    );
  }
}
