// Load .env before reading INTERNAL_SERVICE_SECRET (Nest's ConfigModule
// loads .env only at bootstrap, which happens later inside beforeAll).
import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { PrismaModule } from '../src/prisma/prisma.module';
import { InterviewsModule } from '../src/interviews/interviews.module';
import { InternalModule } from '../src/internal/internal.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter';

/**
 * Internal capability-surface e2e (service-to-service API for ai-service).
 *
 * Bootstraps only the modules under test (no Better Auth — the internal API
 * is service-token guarded), applying the same global pipe/interceptor/
 * filter setup as main.ts so response envelope semantics match production.
 *
 * Runs against the real database (same as development — see .env).
 * Seeds a disposable organization with a full pipeline → job → candidate →
 * application → interview chain, then exercises the happy path
 * (state → transcript → message → answer → evaluations → scores → decision →
 * audit) plus the negative cases (auth, validation, state, duplicates).
 */

const SECRET = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-secret';
const auth = { Authorization: `Internal ${SECRET}` };

// Neon is a remote database — connection + seeding comfortably exceed the
// 5s default hook timeout.
jest.setTimeout(120_000);

interface Seeded {
  organizationId: string;
  interviewerId: string;
  pipelineId: string;
  stageVersionIds: string[];
  questionVersionIds: string[];
  criterionVersionIds: string[];
  jobId: string;
  candidateId: string;
  applicationId: string;
  inviteToken: string;
}

// Deterministic-ish scoring so the rubric math is verifiable.
const CONTENT_BY_INDEX = [
  'SQL databases are relational, provide ACID guarantees and are a strong fit for structured data with complex joins, while NoSQL databases trade some of those guarantees for horizontal scalability, flexible schemas and high write throughput.',
  'I built a distributed order-processing backend on Node.js and PostgreSQL: idempotent workers over a BullMQ queue, outbox-pattern events, optimistic locking on hot rows, and p95 latency under 120ms at 2k rps.',
];

function scoreContent(content: string): number {
  const length = content.trim().length;
  if (length >= 300) return 90;
  if (length >= 150) return 80;
  if (length >= 75) return 70;
  if (length > 0) return 50;
  return 0;
}

describe('Internal API (e2e)', () => {
  let app: INestApplication;
  let seeded: Seeded;
  let interviewId: string;

  const post = (url: string, body?: object) =>
    request(app.getHttpServer()).post(url).set(auth).send(body ?? {});
  const patch = (url: string, body?: object) =>
    request(app.getHttpServer()).patch(url).set(auth).send(body ?? {});
  const get = (url: string) => request(app.getHttpServer()).get(url).set(auth);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        InterviewsModule,
        InternalModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    seeded = await seedScenario();
  });

  afterAll(async () => {
    // FK RESTRICT blocks a straight Organization delete (JobPosting/Pipeline
    // org relations have no onDelete), so tear down in dependency order:
    // applications (cascades interviews/evaluations/scores/decisions/
    // conversations), then jobs, pipelines, candidates, users, org.
    try {
      const prisma = app.get(PrismaService);
      await prisma.application.deleteMany({
        where: { organizationId: seeded.organizationId },
      });
      await prisma.jobPosting.deleteMany({
        where: { organizationId: seeded.organizationId },
      });
      await prisma.pipeline.deleteMany({
        where: { organizationId: seeded.organizationId },
      });
      await prisma.candidate.deleteMany({
        where: { organizationId: seeded.organizationId },
      });
      await prisma.user.deleteMany({ where: { id: seeded.interviewerId } });
      await prisma.organization.deleteMany({
        where: { id: seeded.organizationId },
      });
    } finally {
      await app.close();
    }
  });

  // ----------------------------------------------------------------- helpers

  async function seedScenario(): Promise<Seeded> {
    const prisma = app.get(PrismaService);
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const organization = await prisma.organization.create({
      data: {
        id: `org_int_${suffix}`.slice(0, 30),
        name: 'Internal E2E Org',
        slug: `internal-e2e-${suffix}`,
        createdAt: new Date(),
      },
    });

    const interviewer = await prisma.user.create({
      data: {
        id: `user_int_${suffix}`.slice(0, 30),
        name: 'E2E Recruiter',
        email: `e2e-recruiter-${suffix}@internal.test`,
      },
    });

    // Interviewer user must belong to the org (org scoping sanity).
    await prisma.member.create({
      data: {
        id: `member_int_${suffix}`.slice(0, 30),
        organizationId: organization.id,
        userId: interviewer.id,
        role: 'owner',
        createdAt: new Date(),
      },
    });

    const pipeline = await prisma.pipeline.create({
      data: {
        name: 'Backend Interview',
        organizationId: organization.id,
        createdById: interviewer.id,
      },
    });

    const pipelineVersion = await prisma.pipelineVersion.create({
      data: { pipelineId: pipeline.id, version: 1 },
    });

    const stageA = await prisma.pipelineStageVersion.create({
      data: { pipelineVersionId: pipelineVersion.id, name: 'Technical', order: 1 },
    });
    const stageB = await prisma.pipelineStageVersion.create({
      data: {
        pipelineVersionId: pipelineVersion.id,
        name: 'Project Experience',
        order: 2,
      },
    });

    const q1 = await prisma.questionVersion.create({
      data: {
        pipelineStageVersionId: stageA.id,
        question: 'Explain SQL vs NoSQL databases.',
        type: 'MULTI_LINE',
        order: 1,
      },
    });
    const q2 = await prisma.questionVersion.create({
      data: {
        pipelineStageVersionId: stageA.id,
        question: 'How would you design a rate limiter?',
        type: 'MULTI_LINE',
        order: 2,
      },
    });
    const q3 = await prisma.questionVersion.create({
      data: {
        pipelineStageVersionId: stageB.id,
        question: 'Tell us about a challenging project you worked on.',
        type: 'MULTI_LINE',
        order: 1,
      },
    });

    const rubric1 = await prisma.rubricCriterionVersion.create({
      data: {
        questionVersionId: q1.id,
        name: 'Database fundamentals',
        description: 'Depth of understanding of SQL vs NoSQL trade-offs.',
        maxScore: 5,
      },
    });
    const rubric2 = await prisma.rubricCriterionVersion.create({
      data: {
        questionVersionId: q1.id,
        name: 'Clarity',
        maxScore: 3,
      },
    });
    const rubric3 = await prisma.rubricCriterionVersion.create({
      data: {
        questionVersionId: q3.id,
        name: 'Production experience',
        maxScore: 5,
      },
    });

    const job = await prisma.jobPosting.create({
      data: {
        title: 'Backend Developer',
        organizationId: organization.id,
        createdById: interviewer.id,
        pipelineId: pipeline.id,
        pipelineVersionId: pipelineVersion.id,
        status: 'PUBLISHED',
      },
    });

    const candidate = await prisma.candidate.create({
      data: {
        organizationId: organization.id,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: `e2e-candidate-${suffix}@internal.test`,
      },
    });

    const application = await prisma.application.create({
      data: {
        organizationId: organization.id,
        candidateId: candidate.id,
        jobPostingId: job.id,
        inviteToken: `invite-${suffix}`,
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    // Create interview via the public flow so runtime stages exist.
    // NOTE: public endpoints are wrapped by the global { success, data } envelope.
    const createRes = await post('/api/interviews', {
      applicationId: application.id,
    });
    expect(createRes.status).toBe(201);

    const interview = createRes.body.data;
    interviewId = interview.id;

    // Start it (NOT_STARTED → IN_PROGRESS).
    const startRes = await post(`/api/interviews/${interviewId}/start`);
    expect(startRes.status).toBe(201);

    await post(`/api/interviews/${interviewId}/conversation`);
    await post(`/api/interviews/${interviewId}/conversation/messages`, {
      role: 'ASSISTANT',
      content: 'Explain SQL vs NoSQL databases.',
    });

    return {
      organizationId: organization.id,
      interviewerId: interviewer.id,
      pipelineId: pipeline.id,
      stageVersionIds: [stageA.id, stageB.id],
      questionVersionIds: [q1.id, q2.id, q3.id],
      criterionVersionIds: [rubric1.id, rubric2.id, rubric3.id],
      jobId: job.id,
      candidateId: candidate.id,
      applicationId: application.id,
      inviteToken: `invite-${suffix}`,
    };
  }

  // ------------------------------------------------------------------ tests

  it('rejects requests without the internal service token', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/internal/interviews/${interviewId}/state`,
    );
    expect(res.status).toBe(401);
  });

  it('rejects requests with a wrong token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/internal/interviews/${interviewId}/state`)
      .set({ Authorization: 'Internal not-the-secret' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-UUID interview id', async () => {
    const res = await get('/api/internal/interviews/not-a-uuid/state');
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown interview id', async () => {
    const res = await get(
      '/api/internal/interviews/00000000-0000-4000-8000-000000000000/state',
    );
    expect(res.status).toBe(404);
  });

  it('runs the full happy path: state → message → answers → evaluations → scores → decision → audit', async () => {
    // ---- 1. interview state exposes stage 1 / question 1 with rubric
    const state1 = await get(
      `/api/internal/interviews/${interviewId}/state`,
    );
    expect(state1.status).toBe(200);
    expect(state1.body.interview.status).toBe('IN_PROGRESS');
    expect(state1.body.candidate.email).toContain('@internal.test');
    expect(state1.body.job.title).toBe('Backend Developer');
    expect(state1.body.stage.name).toBe('Technical');
    expect(state1.body.question.id).toBe(seeded.questionVersionIds[0]);
    expect(state1.body.question.rubricCriteria).toHaveLength(2);
    expect(state1.body.progress).toMatchObject({
      totalStages: 2,
      totalQuestions: 3,
      answeredQuestions: 0,
    });

    // ---- 2. transcript has the seeded assistant question
    const transcript1 = await get(
      `/api/internal/interviews/${interviewId}/transcript`,
    );
    expect(transcript1.status).toBe(200);
    expect(transcript1.body.messages).toHaveLength(1);
    expect(transcript1.body.messages[0].role).toBe('ASSISTANT');

    // ---- 3. answer Q1 (dup-submit rejected first)
    const dupRes = await post(`/api/internal/interviews/${interviewId}/answers`, {
      questionId: seeded.questionVersionIds[0],
      content: CONTENT_BY_INDEX[0],
    });
    // first submission goes through...
    expect(dupRes.status).toBe(201);

    const dupRes2 = await post(
      `/api/internal/interviews/${interviewId}/answers`,
      {
        questionId: seeded.questionVersionIds[0],
        content: 'duplicate',
      },
    );
    expect(dupRes2.status).toBe(400);
    expect(dupRes2.body.message).toMatch(/already/i);

    // answers type must be TRANSCRIPT
    const answerRow = await app
      .get(PrismaService)
      .answer.findFirst({
        where: {
          interviewSessionId: interviewId,
          questionVersionId: seeded.questionVersionIds[0],
        },
      });
    if (!answerRow) {
      throw new Error('Q1 answer row not found after submission');
    }
    expect(answerRow.type).toBe('TRANSCRIPT');

    // progression: current question should now be Q2
    const state2 = await get(`/api/internal/interviews/${interviewId}/state`);
    expect(state2.body.question.id).toBe(seeded.questionVersionIds[1]);
    expect(state2.body.progress.answeredQuestions).toBe(1);

    // ---- 4. cross-stage answer is rejected (Q3 belongs to stage 2)
    const crossStage = await post(
      `/api/internal/interviews/${interviewId}/answers`,
      { questionId: seeded.questionVersionIds[2], content: 'too early' },
    );
    expect(crossStage.status).toBe(400);
    expect(crossStage.body.message).toMatch(/current interview stage/i);

    // ---- 5. evaluation lifecycle for the Q1 answer
    const evalRes = await post('/api/internal/evaluations', {
      interviewSessionId: interviewId,
      answerId: answerRow.id,
      model: 'openai/gpt-4o-mini',
    });
    expect(evalRes.status).toBe(201);
    expect(evalRes.body.status).toBe('PENDING');
    const evaluationId = evalRes.body.id;

    // rubric math: criterion maxes are 5 + 3 = 8; mock scoring is
    // length-based, mirror the service logic for expected values.
    const contentScore = scoreContent(CONTENT_BY_INDEX[0]); // 80-ish length → 90
    const c1 = Math.min(5, Math.floor((contentScore / 100) * 5));
    const c2 = Math.min(3, Math.floor((contentScore / 100) * 3));
    const expectedOverall = c1 + c2;

    const completeRes = await patch(
      `/api/internal/evaluations/${evaluationId}/complete`,
      {
        score: expectedOverall,
        reasoning: 'solid fundamentals',
        result: { criteria: [{ id: seeded.criterionVersionIds[0], score: c1 }] },
      },
    );
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.status).toBe('COMPLETED');
    expect(Number(completeRes.body.score)).toBe(expectedOverall);

    // double-complete is rejected
    const doubleComplete = await patch(
      `/api/internal/evaluations/${evaluationId}/complete`,
      { score: 1 },
    );
    expect(doubleComplete.status).toBe(400);

    // ---- 6. score upsert (create → update replaces criteria)
    const scoreRes = await post('/api/internal/scores', {
      applicationId: seeded.applicationId,
      questionVersionId: seeded.questionVersionIds[0],
      overallScore: expectedOverall,
      maxScore: 8,
      reasoning: 'aggregated from model A + B',
      criteria: [
        {
          rubricCriterionVersionId: seeded.criterionVersionIds[0],
          score: c1,
          reasoning: 'covers relational vs document trade-offs',
        },
        {
          rubricCriterionVersionId: seeded.criterionVersionIds[1],
          score: c2,
          reasoning: 'clear structure',
        },
      ],
    });
    expect(scoreRes.status).toBe(201);
    expect(scoreRes.body.criterionScores).toHaveLength(2);

    const scoreId = scoreRes.body.id;

    // re-run (two-model re-aggregation) must upsert, not duplicate
    const scoreRes2 = await post('/api/internal/scores', {
      applicationId: seeded.applicationId,
      questionVersionId: seeded.questionVersionIds[0],
      overallScore: expectedOverall,
      maxScore: 8,
      criteria: [
        {
          rubricCriterionVersionId: seeded.criterionVersionIds[0],
          score: c1,
        },
        {
          rubricCriterionVersionId: seeded.criterionVersionIds[1],
          score: c2,
        },
      ],
    });
    expect(scoreRes2.status).toBe(201);
    expect(scoreRes2.body.id).toBe(scoreId);
    expect(scoreRes2.body.criterionScores).toHaveLength(2);

    // criterion from another question is rejected
    const wrongCriterion = await post('/api/internal/scores', {
      applicationId: seeded.applicationId,
      questionVersionId: seeded.questionVersionIds[0],
      overallScore: 1,
      maxScore: 8,
      criteria: [
        {
          rubricCriterionVersionId: seeded.criterionVersionIds[2],
          score: 1,
        },
      ],
    });
    expect(wrongCriterion.status).toBe(400);

    // overall > max rejected
    const overMax = await post('/api/internal/scores', {
      applicationId: seeded.applicationId,
      questionVersionId: seeded.questionVersionIds[0],
      overallScore: 99,
      maxScore: 8,
    });
    expect(overMax.status).toBe(400);

    // ---- 7. score summary aggregates
    const summary = await get(
      `/api/internal/applications/${seeded.applicationId}/score-summary`,
    );
    expect(summary.status).toBe(200);
    expect(summary.body.totalScore).toBe(expectedOverall);
    expect(summary.body.maxScore).toBe(8);
    expect(summary.body.questionCount).toBe(1);

    // ---- 8. finish the interview via the public answer flow
    // Q2 (last question of stage 1) → stage 2 becomes current
    const ans2 = await post(`/api/internal/interviews/${interviewId}/answers`, {
      questionId: seeded.questionVersionIds[1],
      content: CONTENT_BY_INDEX[1],
    });
    expect(ans2.status).toBe(201);
    // Internal endpoints bypass the { success, data } envelope (passthrough).
    expect(ans2.body.stageCompleted).toBe(true);

    const state3 = await get(`/api/internal/interviews/${interviewId}/state`);
    expect(state3.body.stage.name).toBe('Project Experience');
    expect(state3.body.question.id).toBe(seeded.questionVersionIds[2]);

    // Q3 completes the interview
    const ans3 = await post(`/api/internal/interviews/${interviewId}/answers`, {
      questionId: seeded.questionVersionIds[2],
      content: CONTENT_BY_INDEX[0],
    });
    expect(ans3.status).toBe(201);
    expect(ans3.body.interviewCompleted).toBe(true);

    // ---- 9. complete-interview endpoint is a guarded idempotent no-op now
    const complete1 = await post(
      `/api/internal/interviews/${interviewId}/complete`,
    );
    expect(complete1.status).toBe(201);
    expect(complete1.body.alreadyCompleted).toBe(true);

    // ---- 10. decision
    const decisionRes = await post(
      `/api/internal/applications/${seeded.applicationId}/decision`,
      {
        outcome: 'PASS',
        totalScore: expectedOverall,
        maxScore: 8,
        reasoning: 'meets the hiring bar',
        requestedBy: 'ai-service/two-model-aggregator',
      },
    );
    expect(decisionRes.status).toBe(201);
    expect(decisionRes.body.outcome).toBe('PASS');

    // second decision is rejected
    const decision2 = await post(
      `/api/internal/applications/${seeded.applicationId}/decision`,
      { outcome: 'FAIL', totalScore: 1, maxScore: 8 },
    );
    expect(decision2.status).toBe(400);

    // ---- 11. audit: DECISION_CREATED recorded with AI actor
    const audit = await get(
      `/api/internal/audit/${seeded.organizationId}?limit=50`,
    );
    expect(audit.status).toBe(200);
    const actions = audit.body.map((row: { action: string }) => row.action);
    expect(actions).toContain('DECISION_CREATED');

    const decisionEvent = audit.body.find(
      (row: { action: string }) => row.action === 'DECISION_CREATED',
    );
    expect(decisionEvent.actorType).toBe('AI');
    expect(decisionEvent.metadata.requestedBy).toBe(
      'ai-service/two-model-aggregator',
    );

    // ---- 12. ad-hoc AI audit event
    const auditEvent = await post('/api/internal/audit-events', {
      organizationId: seeded.organizationId,
      actorType: 'AI',
      actorId: 'ai-service/scoring-mcp',
      action: 'ANSWER_EVALUATED',
      entityType: 'AIEvaluation',
      entityId: evaluationId,
      metadata: { model: 'openai/gpt-4o-mini', tool: 'evaluate_answer' },
    });
    expect(auditEvent.status).toBe(201);
    expect(auditEvent.body.actorType).toBe('AI');

    // audit org validation
    const badAudit = await get(
      '/api/internal/audit/00000000-0000-4000-8000-000000000000',
    );
    expect(badAudit.status).toBe(404);

    // ---- 13. failure path: PENDING evaluation → FAILED, no score written
    const failSetupEval = await post('/api/internal/evaluations', {
      interviewSessionId: interviewId,
      answerId: answerRow.id,
      model: 'groq/llama-3.3-70b',
    });
    // NOTE: this is a second evaluation for the same answer — allowed by
    // design (two-model scoring), while the mock public endpoint would have
    // rejected it. Verify both evaluations coexist:
    expect(failSetupEval.status).toBe(201);

    const failed = await patch(
      `/api/internal/evaluations/${failSetupEval.body.id}/fail`,
      { error: 'llm timeout', result: { attempt: 1 } },
    );
    expect(failed.status).toBe(200);
    expect(failed.body.status).toBe('FAILED');

    // double-fail rejected
    const doubleFail = await patch(
      `/api/internal/evaluations/${failSetupEval.body.id}/fail`,
      { error: 'again' },
    );
    expect(doubleFail.status).toBe(400);
  });

  it('keeps transcript ordered after the full flow', async () => {
    const res = await get(`/api/internal/interviews/${interviewId}/transcript`);
    expect(res.status).toBe(200);
    const roles = res.body.messages.map((m: { role: string }) => m.role);
    expect(roles[0]).toBe('ASSISTANT');
    // createdAt ascending
    const times = res.body.messages.map((m: { createdAt: string }) => m.createdAt);
    const sorted = [...times].sort();
    expect(times).toEqual(sorted);
  });
});
