import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFakeChatProvider } from '../../llm/chat.js';
import {
  buildAckInstruction,
  buildInterviewerPrompt,
  type InterviewerContext,
} from '../interviewer/prompts.js';

const ctx = (over: Partial<InterviewerContext> = {}): InterviewerContext => ({
  candidateName: 'Ada Lovelace',
  jobTitle: 'Backend Engineer',
  stageName: 'Technical',
  stageOrder: 1,
  totalStages: 2,
  currentQuestion: {
    question: 'Explain the difference between SQL and NoSQL databases.',
    type: 'TEXT',
    options: [],
  },
  progress: { answeredQuestions: 0, totalQuestions: 3 },
  recentTurns: [],
  ...over,
});

describe('interviewer prompt', () => {
  it('embeds the snapshot question verbatim', () => {
    const prompt = buildInterviewerPrompt(ctx());
    assert.ok(prompt.includes('Explain the difference between SQL and NoSQL databases.'));
  });

  it('forbids inventing questions', () => {
    const prompt = buildInterviewerPrompt(ctx());
    assert.match(prompt, /Never invent/);
    assert.match(prompt, /Ask ONLY the question shown above/);
  });

  it('forbids leaking rubric or outcome information', () => {
    const prompt = buildInterviewerPrompt(ctx());
    assert.match(prompt, /Never reveal or guess rubric criteria/);
    assert.match(prompt, /Never promise the candidate an offer/);
  });

  it('lists MCQ options without inventing new ones', () => {
    const prompt = buildInterviewerPrompt(
      ctx({
        currentQuestion: {
          question: 'Pick one.',
          type: 'MCQ',
          options: [{ text: 'Postgres' }, { text: 'MongoDB' }],
        },
      }),
    );
    assert.match(prompt, /1\. Postgres/);
    assert.match(prompt, /2\. MongoDB/);
    assert.match(prompt, /do not add others/);
  });

  it('tells the model to wrap up when there is no current question', () => {
    const prompt = buildInterviewerPrompt(ctx({ currentQuestion: null }));
    assert.match(prompt, /NO current question/);
    assert.match(prompt, /Do NOT ask anything else/);
    assert.ok(!prompt.includes('<question>'));
  });

  it('includes stage and progress context', () => {
    const prompt = buildInterviewerPrompt(
      ctx({ progress: { answeredQuestions: 2, totalQuestions: 3 } }),
    );
    assert.match(prompt, /2 of 3 questions answered/);
    assert.match(prompt, /stage 1 of 2/);
  });
});

describe('ack instruction', () => {
  it('asks for acknowledgement then continuation mid-stage', () => {
    const ack = buildAckInstruction(ctx());
    assert.match(ack, /acknowledge their answer/);
    assert.match(ack, /continue with the interview/);
  });

  it('asks for a move to the next question near a stage end', () => {
    const ack = buildAckInstruction(
      ctx({ progress: { answeredQuestions: 2, totalQuestions: 3 } }),
    );
    assert.match(ack, /Technical/);
  });

  it('forbids further questions once the interview is done', () => {
    const ack = buildAckInstruction(ctx({ currentQuestion: null }));
    assert.match(ack, /Ask nothing further/);
  });
});

describe('fake chat provider (deterministic fallback)', () => {
  const provider = createFakeChatProvider();

  it('relays the fenced question rather than inventing one', async () => {
    const system = buildInterviewerPrompt(ctx());
    const res = await provider.chat({
      messages: [{ role: 'system', content: system }, { role: 'user', content: 'Hi' }],
    });
    assert.ok(res.content.includes('Explain the difference between SQL and NoSQL databases.'));
  });

  it('acknowledges after a candidate turn', async () => {
    const system = buildInterviewerPrompt(ctx());
    const res = await provider.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Briefly acknowledge their answer' },
        { role: 'user', content: 'I use Postgres for relational data.' },
      ],
    });
    assert.match(res.content, /Great, thank you/);
  });

  it('wraps up when no question is fenced', async () => {
    const system = buildInterviewerPrompt(ctx({ currentQuestion: null }));
    const res = await provider.chat({ messages: [{ role: 'system', content: system }] });
    assert.match(res.content, /recruiter will be in touch/);
  });

  it('is deterministic across calls', async () => {
    const system = buildInterviewerPrompt(ctx());
    const msgs = [{ role: 'system' as const, content: system }, { role: 'user' as const, content: 'Hi' }];
    const a = await provider.chat({ messages: msgs });
    const b = await provider.chat({ messages: msgs });
    assert.equal(a.content, b.content);
  });
});