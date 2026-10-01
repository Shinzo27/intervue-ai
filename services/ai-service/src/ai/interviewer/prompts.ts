/**
 * System prompt construction for the conversational interviewer
 * (master-note §39, §40, §64).
 *
 * Hard rule, straight from the spec: **the pipeline snapshot is the source of
 * truth**. The model is given the current question verbatim and is explicitly
 * forbidden from inventing, rewording into a different question, or skipping
 * ahead. Everything it knows about structure arrives through the Pipeline MCP,
 * never from its own imagination.
 */

export interface InterviewerContext {
  candidateName: string;
  jobTitle: string;
  stageName: string;
  stageOrder: number;
  totalStages: number;
  /** The one question the agent may ask now, verbatim from the snapshot. */
  currentQuestion: {
    question: string;
    type: string;
    options: { text: string }[];
  } | null;
  progress: {
    answeredQuestions: number;
    totalQuestions: number;
  };
  /** Recent transcript turns, oldest first, for conversational continuity. */
  recentTurns: { role: string; content: string }[];
}

/**
 * Build the system prompt. The question is embedded verbatim and fenced so the
 * model treats it as data to relay, not as text to paraphrase.
 */
export function buildInterviewerPrompt(ctx: InterviewerContext): string {
  const { currentQuestion, progress } = ctx;

  const questionBlock = currentQuestion
    ? [
        'ASK THIS QUESTION — relay it verbatim, do not reword it:',
        '<question>',
        currentQuestion.question,
        '</question>',
        currentQuestion.options.length
          ? '\nValid options (present these as choices, do not add others):\n' +
            currentQuestion.options.map((o, i) => `  ${i + 1}. ${o.text}`).join('\n')
          : '',
      ].join('\n')
    : [
        'There is NO current question. The interview is finished.',
        'Thank the candidate warmly, summarise that their answers have been recorded,',
        'and tell them a recruiter will follow up. Do NOT ask anything else.',
      ].join('\n');

  const history = ctx.recentTurns.length
    ? `\n\nRECENT CONVERSATION (for context only — do not repeat these turns):\n${ctx.recentTurns
        .map((t) => `${t.role === 'CANDIDATE' ? 'Candidate' : 'Interviewer'}: ${t.content}`)
        .join('\n')}`
    : '';

  return `You are the AI interviewer for ${ctx.jobTitle} at a company hiring via Intervue AI.
You are speaking with ${ctx.candidateName}.

CURRENT STAGE: ${ctx.stageName} (stage ${ctx.stageOrder} of ${ctx.totalStages})
PROGRESS: ${progress.answeredQuestions} of ${progress.totalQuestions} questions answered.

${questionBlock}${history}

RULES — these are absolute:
1. Ask ONLY the question shown above, verbatim. Never invent, merge, split, or
   paraphrase a different question, and never invent follow-ups or probing
   sub-questions.
2. Never reveal or guess rubric criteria, scores, thresholds, or hiring outcomes.
3. Never promise the candidate an offer or any outcome.
4. If the candidate's answer is unclear, ask ONE short clarifying question about
   what they said, then return to the question above.
5. Be warm, concise, and professional. Two sentences maximum per turn.
6. Do not output markdown, bullet lists, or stage names — plain conversational text.`;
}

/**
 * Instruction for the turn where the candidate has just answered. Kept separate
 * from the system prompt because the model must acknowledge the answer before
 * moving to whatever comes next.
 */
export function buildAckInstruction(ctx: InterviewerContext): string {
  if (!ctx.currentQuestion) {
    return 'The candidate has answered the final question. Thank them, confirm their answers are recorded, and let them know a recruiter will be in touch. Ask nothing further.';
  }

  const remaining = ctx.progress.totalQuestions - ctx.progress.answeredQuestions;
  if (ctx.stageName && remaining <= 1) {
    return `Briefly acknowledge their answer, then move on to the next question in "${ctx.stageName}".`;
  }
  return 'Briefly acknowledge their answer, then continue with the interview.';
}