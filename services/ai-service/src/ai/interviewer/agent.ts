import type { BackendClient } from '../../backend/client.js';
import type { ScoringOrchestrator } from '../../scoring/scoring.service.js';
import type { ChatMessage, ChatProvider } from '../../llm/chat.js';
import { buildAckInstruction, buildInterviewerPrompt, type InterviewerContext } from './prompts.js';

/**
 * Conversational interviewer agent (master-note §39, §40).
 *
 * Turn flow for a candidate message:
 *   1. ensure a Conversation row exists (idempotent transcript bootstrap)
 *   2. persist the candidate turn  → Message(CANDIDATE)
 *   3. submit the answer against the CURRENT question (the backend advances
 *      question/stage/interview pointers transactionally)
 *   4. re-read state, then ask the next question verbatim from the snapshot
 *      → Message(ASSISTANT)
 *   5. evaluate the answer asynchronously — never blocks the next question
 *
 * Two invariants this class exists to protect:
 *  - **The agent never invents questions.** It relays whatever the pipeline
 *    snapshot says is current; with no current question it wraps up instead of
 *    asking anything further.
 *  - **The backend owns state.** The agent never moves a pointer itself.
 */

export interface InterviewerDeps {
  client: BackendClient;
  orchestrator: ScoringOrchestrator;
  chat: ChatProvider;
}

export interface TurnResult {
  interviewId: string;
  reply: string;
  /** True when the interviewer used the deterministic fallback path. */
  fallback: boolean;
  stageCompleted: boolean;
  interviewCompleted: boolean;
  /** Present when an answer was persisted and queued for evaluation. */
  answerId: string | null;
  evaluation: {
    queued: boolean;
    overallScore: number | null;
    needsHumanReview: boolean;
    error?: string;
  };
  progress: {
    answeredQuestions: number;
    totalQuestions: number;
    totalStages: number;
    completedStages: number;
  };
  currentQuestion: string | null;
  fallbackReason?: string;
}

const HISTORY_TURNS = 6;

export class InterviewerAgent {
  constructor(private readonly deps: InterviewerDeps) {}

  /**
   * Open the conversation: greet the candidate and ask the current question.
   * Called on interview start and on portal load when no assistant turn exists.
   */
  async start(interviewId: string, traceId: string): Promise<TurnResult> {
    await this.deps.client.ensureConversation(interviewId, traceId);
    const state = await this.deps.client.getInterviewState(interviewId, traceId);
    const context = this.toContext(state, []);

    const ask = await this.ask(context, [], traceId);
    const reply = ask.text;
    await this.deps.client.appendMessage(
      interviewId,
      {
        role: 'ASSISTANT',
        content: reply,
        metadata: { source: 'interviewer-agent', mode: context.currentQuestion ? 'live' : 'closing' },
      },
      traceId,
    );

    return {
      interviewId,
      reply,
      fallback: ask.fallback,
      stageCompleted: false,
      interviewCompleted: state.interview.status === 'COMPLETED',
      answerId: null,
      evaluation: { queued: false, overallScore: null, needsHumanReview: false },
      progress: state.progress,
      currentQuestion: context.currentQuestion?.question ?? null,
    };
  }

  /** Handle one candidate turn end-to-end. */
  async handleCandidateMessage(
    interviewId: string,
    content: string,
    traceId: string,
  ): Promise<TurnResult> {
    const { client } = this.deps;

    await client.ensureConversation(interviewId, traceId);
    const before = await client.getInterviewState(interviewId, traceId);

    if (before.interview.status === 'COMPLETED') {
      // Late message on a finished interview: persist it for the record (the
      // candidate did say it — do not silently discard it), but never attach it
      // to a question, score it, or move any pointer. The recruiter sees the
      // afterthought in the transcript; scoring state stays exactly as it was.
      await client.appendMessage(
        interviewId,
        {
          role: 'CANDIDATE',
          content,
          metadata: { source: 'interviewer-agent', late: true, scored: false },
        },
        traceId,
      );
      const reply =
        'Thanks for getting back to me — this interview is already complete, and your answers are with the recruiter.';
      await client.appendMessage(
        interviewId,
        { role: 'ASSISTANT', content: reply, metadata: { source: 'interviewer-agent', late: true } },
        traceId,
      );
      return {
        interviewId,
        reply,
        fallback: false,
        stageCompleted: true,
        interviewCompleted: true,
        answerId: null,
        evaluation: { queued: false, overallScore: null, needsHumanReview: false },
        progress: before.progress,
        currentQuestion: null,
      };
    }

    await client.appendMessage(
      interviewId,
      {
        role: 'CANDIDATE',
        content,
        metadata: { source: 'interviewer-agent', stageId: before.stage?.id ?? null },
      },
      traceId,
    );

    // Submit against the question that was current BEFORE this turn.
    const questionId = before.question?.id;
    if (!questionId) {
      const reply =
        'Thank you — your answers have been recorded and a recruiter will follow up.';
      await client.appendMessage(
        interviewId,
        { role: 'ASSISTANT', content: reply, metadata: { source: 'interviewer-agent', closing: true } },
        traceId,
      );
      const after = await client.getInterviewState(interviewId, traceId);
      return {
        interviewId,
        reply,
        fallback: false,
        stageCompleted: true,
        interviewCompleted: after.interview.status === 'COMPLETED',
        answerId: null,
        evaluation: { queued: false, overallScore: null, needsHumanReview: false },
        progress: after.progress,
        currentQuestion: null,
      };
    }

    const submission = await client.submitAnswer(
      interviewId,
      { questionId, content },
      traceId,
    );

    // Re-read authoritative state: the backend already advanced the pointers.
    const after = await client.getInterviewState(interviewId, traceId);
    const transcript = await client.getTranscript(interviewId, traceId);
    const context = this.toContext(after, recentTurns(transcript, HISTORY_TURNS));

    const ask = await this.ask(context, [{ role: 'user', content }], traceId);
    const reply = ask.text;

    await client.appendMessage(
      interviewId,
      {
        role: 'ASSISTANT',
        content: reply,
        metadata: {
          source: 'interviewer-agent',
          stageId: after.stage?.id ?? null,
          stageCompleted: submission.stageCompleted,
          interviewCompleted: submission.interviewCompleted,
          mode: ask.fallback ? 'fallback' : 'live',
        },
      },
      traceId,
    );

    if (submission.interviewCompleted) {
      await client.completeInterview(interviewId, traceId).catch(() => undefined);
    }

    // Scoring must never block the conversation: run it after the reply is
    // persisted, and surface failure without losing the candidate's progress.
    const evaluation = await this.scoreQuietly(submission.answer.id, traceId);

    return {
      interviewId,
      reply,
      fallback: ask.fallback,
      stageCompleted: submission.stageCompleted,
      interviewCompleted: submission.interviewCompleted,
      answerId: submission.answer.id,
      evaluation,
      progress: after.progress,
      currentQuestion: context.currentQuestion?.question ?? null,
      fallbackReason: ask.reason,
    };
  }

  /**
   * Produce the interviewer's next utterance.
   *
   * On LLM failure or empty output we fall back to the deterministic path: the
   * current question verbatim. The interview must never dead-end because an AI
   * provider is unavailable (§8).
   */
  private async ask(
    context: InterviewerContext,
    extraUserTurns: ChatMessage[],
    traceId: string,
  ): Promise<{ text: string; fallback: boolean; reason?: string }> {
    const system = buildInterviewerPrompt(context);

    if (!context.currentQuestion) {
      return {
        text: 'Thank you for completing the interview. Your answers have been recorded and a recruiter will follow up.',
        fallback: false,
      };
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      ...context.recentTurns.map((t) => ({
        role: (t.role === 'CANDIDATE' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: t.content,
      })),
    ];

    if (extraUserTurns.length) {
      // Tell the model to acknowledge the fresh answer before moving on, so it
      // does not simply re-ask the next question without acknowledging.
      messages.push({ role: 'user', content: buildAckInstruction(context) });
      messages.push(...extraUserTurns);
    }

    try {
      const response = await this.deps.chat.chat({ messages, maxTokens: 300 });
      const text = response.content.trim();
      if (!text) {
        return { text: this.fallbackText(context), fallback: true, reason: 'empty LLM response' };
      }
      return { text, fallback: false };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { text: this.fallbackText(context), fallback: true, reason };
    }
  }

  /** Deterministic fallback: ask the snapshot question verbatim. */
  private fallbackText(context: InterviewerContext): string {
    const q = context.currentQuestion;
    if (!q) {
      return 'Thank you for completing the interview. Your answers have been recorded and a recruiter will follow up.';
    }
    return `Thanks for your answer. ${q.question}`;
  }

  /** Score the answer without ever failing the turn. */
  private async scoreQuietly(
    answerId: string,
    traceId: string,
  ): Promise<TurnResult['evaluation']> {
    try {
      const outcome = await this.deps.orchestrator.scoreAnswer(answerId, traceId);
      return {
        queued: true,
        overallScore: outcome.overallScore,
        needsHumanReview: outcome.needsHumanReview,
      };
    } catch (error) {
      // The answer is already stored; scoring can be retried from the queue.
      return {
        queued: false,
        overallScore: null,
        needsHumanReview: true,
        error: error instanceof Error ? error.message.slice(0, 200) : String(error),
      };
    }
  }

  /** Map backend interview state onto the prompt builder's inputs. */
  private toContext(
    state: Awaited<ReturnType<BackendClient['getInterviewState']>>,
    recentTurns: { role: string; content: string }[],
  ): InterviewerContext {
    return {
      candidateName: state.candidate.name,
      jobTitle: state.job.title,
      stageName: state.stage?.name ?? 'wrap-up',
      stageOrder: (state.stage?.order ?? 0) + 1,
      totalStages: state.progress.totalStages,
      currentQuestion: state.question
        ? {
            question: state.question.question,
            type: state.question.type,
            options: (state.question.options ?? []).map((o) => ({ text: o.text })),
          }
        : null,
      progress: {
        answeredQuestions: state.progress.answeredQuestions,
        totalQuestions: state.progress.totalQuestions,
      },
      recentTurns,
    };
  }
}

/** Last N transcript turns, oldest first. */
function recentTurns(
  transcript: Awaited<ReturnType<BackendClient['getTranscript']>>,
  limit: number,
): { role: string; content: string }[] {
  const messages = transcript.messages ?? [];
  return messages.slice(-limit).map((m) => ({ role: m.role, content: m.content }));
}