import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Tenant boundary on the recruiter-facing interview surface (master-note §53:
 * "Queries must prevent cross-tenant access").
 *
 * Before this spec existed, every method here looked an interview up by id
 * alone, so any authenticated member of any organization could start, read,
 * answer for, or score another tenant's interview. The fix pushes the
 * organization into the query itself (`application: { organizationId }`), and
 * these tests assert BOTH halves of that: a foreign id is not found, and the
 * filter travels with the query rather than being applied afterwards.
 */

const ORG = 'org-a';
const OTHER_ORG = 'org-b';

type WhereArgs = {
  where: { id: string; application?: { organizationId?: string } };
};

function buildService(ownOrg = ORG) {
  const interviewSessionFindFirst = jest.fn((args: WhereArgs) =>
    args.where.application?.organizationId === ownOrg
      ? {
          id: args.where.id,
          applicationId: 'app-1',
          status: 'NOT_STARTED',
          currentStage: null,
          application: { id: 'app-1', organizationId: ownOrg },
        }
      : null,
  );

  const applicationFindFirst = jest.fn(
    (args: { where: { id: string; organizationId: string } }) =>
      args.where.organizationId === ownOrg
        ? // No job posting attached: the domain rule fires only after the
          // scoped read succeeds, which is what the positive control checks.
          { id: args.where.id, jobPosting: null }
        : null,
  );

  // Always "not found": the assertion that matters here is the shape of the
  // query, which the caller-side tests inspect below.
  const answerFindFirst = jest.fn(() => null);

  const prisma = {
    interviewSession: { findFirst: interviewSessionFindFirst },
    application: { findFirst: applicationFindFirst },
    answer: { findFirst: answerFindFirst },
    conversation: { findUnique: jest.fn(() => null) },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  return {
    service: new InterviewsService(prisma, {
      notifyCompletion: jest.fn(() => undefined),
    } as unknown as ConstructorParameters<typeof InterviewsService>[1]),
    interviewSessionFindFirst,
    applicationFindFirst,
    answerFindFirst,
  };
}

describe('InterviewsService tenant boundary', () => {
  const foreignCalls: Array<
    [string, (service: InterviewsService) => Promise<unknown>]
  > = [
    ['createInterview', (s) => s.createInterview('app-1', OTHER_ORG)],
    ['startInterview', (s) => s.startInterview('interview-1', OTHER_ORG)],
    [
      'getCurrentInterview',
      (s) => s.getCurrentInterview('interview-1', OTHER_ORG),
    ],
    [
      'submitAnswer',
      (s) =>
        s.submitAnswer(
          'interview-1',
          { questionId: 'q-1', content: 'x' } as never,
          OTHER_ORG,
        ),
    ],
    [
      'evaluateAnswer',
      (s) => s.evaluateAnswer('interview-1', 'answer-1', OTHER_ORG),
    ],
    [
      'createConversation',
      (s) => s.createConversation('interview-1', OTHER_ORG),
    ],
    [
      'createMessage',
      (s) =>
        s.createMessage(
          'interview-1',
          { role: 'USER', content: 'x' } as never,
          OTHER_ORG,
        ),
    ],
    ['getConversation', (s) => s.getConversation('interview-1', OTHER_ORG)],
    [
      'getCandidateTranscript',
      (s) => s.getCandidateTranscript('interview-1', OTHER_ORG),
    ],
  ];

  it.each(foreignCalls)(
    '%s refuses an interview from another organization as not found',
    async (_name, call) => {
      const { service } = buildService();

      await expect(call(service)).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('pushes the organization into the interview query, not a post-check', async () => {
    const { service, interviewSessionFindFirst } = buildService();

    await expect(
      service.getConversation('interview-1', ORG),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(interviewSessionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'interview-1', application: { organizationId: ORG } },
      }),
    );
  });

  it('scopes answer evaluation through the interview, not just the answer id', async () => {
    const { service, answerFindFirst } = buildService();

    await expect(
      service.evaluateAnswer('interview-1', 'answer-1', ORG),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(answerFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'answer-1',
          interviewSessionId: 'interview-1',
          interviewSession: { application: { organizationId: ORG } },
        },
      }),
    );
  });

  it('still resolves an interview inside the caller own organization', async () => {
    const { service } = buildService();

    // Past the scoped read, so the failure is the domain rule — not a 404.
    await expect(
      service.startInterview('interview-1', ORG),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.createInterview('app-1', ORG)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
