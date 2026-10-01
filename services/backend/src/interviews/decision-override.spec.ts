import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Human-override guarantees (master-note §43, §44, §64 rule 3).
 *
 * These tests exist because the override path is the one place a persisted
 * hiring decision changes after the fact — the claim being protected is that
 * history is PRESERVED and that a human override is always distinguishable
 * from an AI recommendation. §44: "This history must never be silently
 * overwritten."
 */

const ORG = 'org-a';
const OTHER_ORG = 'org-b';

interface Overrides {
  interviewOrg?: string;
  decisionOutcome?: 'PASS' | 'FAIL';
  decisionExists?: boolean;
}

function buildService(overrides: Overrides = {}) {
  const {
    interviewOrg = ORG,
    decisionOutcome = 'PASS',
    decisionExists = true,
  } = overrides;

  const calls = {
    decisionOverrideCreate: jest.fn(async (args: { data: unknown }) => ({
      id: 'override-1',
      ...(args.data as object),
    })),
    decisionUpdate: jest.fn(async (args: { data: unknown }) => ({
      id: 'decision-1',
      outcome: (args.data as { outcome: string }).outcome,
    })),
    auditLogCreate: jest.fn(async (args: { data: unknown }) => args.data),
    decisionCreate: jest.fn(async (args: { data: unknown }) => args.data),
  };

  const tx = {
    decisionOverride: { create: calls.decisionOverrideCreate },
    decision: { update: calls.decisionUpdate },
    auditLog: { create: calls.auditLogCreate },
  };

  const prisma = {
    interviewSession: {
      findUnique: jest.fn(async () => ({
        id: 'interview-1',
        applicationId: 'app-1',
        application: { id: 'app-1', organizationId: interviewOrg },
      })),
    },
    decision: {
      findUnique: jest.fn(async () =>
        decisionExists
          ? { id: 'decision-1', applicationId: 'app-1', outcome: decisionOutcome }
          : null,
      ),
      create: calls.decisionCreate,
    },
    score: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  } as unknown as PrismaService;

  return { service: new InterviewsService(prisma), calls, prisma };
}

describe('InterviewsService.overrideDecision', () => {
  it('preserves the previous outcome and writes a distinct override row', async () => {
    const { service, calls } = buildService({ decisionOutcome: 'FAIL' });

    const result = (await service.overrideDecision(
      'interview-1',
      'user-1',
      { newOutcome: 'PASS', reason: 'Strong production experience' } as never,
      ORG,
    )) as { override: { previousOutcome: string; newOutcome: string; reason: string } };

    expect(calls.decisionOverrideCreate).toHaveBeenCalledTimes(1);
    // §44: the OLD outcome must be recorded, not discarded.
    expect(result.override.previousOutcome).toBe('FAIL');
    expect(result.override.newOutcome).toBe('PASS');
    expect(result.override.reason).toBe('Strong production experience');
  });

  it('updates the decision to the new outcome', async () => {
    const { service, calls } = buildService({ decisionOutcome: 'FAIL' });

    await service.overrideDecision(
      'interview-1',
      'user-1',
      { newOutcome: 'PASS', reason: 'r' } as never,
      ORG,
    );

    expect(calls.decisionUpdate).toHaveBeenCalledTimes(1);
    expect(
      (calls.decisionUpdate.mock.calls[0][0] as { data: { outcome: string } }).data
        .outcome,
    ).toBe('PASS');
  });

  it('audits the override as a USER action, never as AI', async () => {
    const { service, calls } = buildService({ decisionOutcome: 'FAIL' });

    await service.overrideDecision(
      'interview-1',
      'user-1',
      { newOutcome: 'PASS', reason: 'r' } as never,
      ORG,
    );

    const audited = calls.auditLogCreate.mock.calls[0][0] as {
      data: { actorType: string; actorId: string; action: string; metadata: Record<string, unknown> };
    };

    // §64 rule 3: AI actions must be distinguishable from human actions forever.
    expect(audited.data.actorType).toBe('USER');
    expect(audited.data.actorType).not.toBe('AI');
    expect(audited.data.actorId).toBe('user-1');
    expect(audited.data.action).toBe('DECISION_OVERRIDDEN');
    expect(audited.data.metadata.previousOutcome).toBe('FAIL');
    expect(audited.data.metadata.newOutcome).toBe('PASS');
  });

  it('refuses an override that does not change the outcome', async () => {
    const { service, calls } = buildService({ decisionOutcome: 'PASS' });

    await expect(
      service.overrideDecision(
        'interview-1',
        'user-1',
        { newOutcome: 'PASS', reason: 'r' } as never,
        ORG,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(calls.decisionOverrideCreate).not.toHaveBeenCalled();
  });

  it('refuses to override when no decision exists yet', async () => {
    const { service } = buildService({ decisionExists: false });

    await expect(
      service.overrideDecision(
        'interview-1',
        'user-1',
        { newOutcome: 'PASS', reason: 'r' } as never,
        ORG,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a cross-organization override and reports it as not found', async () => {
    const { service, calls } = buildService({ interviewOrg: OTHER_ORG });

    // 404 (not 403) so the endpoint never confirms another tenant's interview exists.
    await expect(
      service.overrideDecision(
        'interview-1',
        'user-1',
        { newOutcome: 'PASS', reason: 'r' } as never,
        ORG,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(calls.decisionOverrideCreate).not.toHaveBeenCalled();
    expect(calls.decisionUpdate).not.toHaveBeenCalled();
    expect(calls.auditLogCreate).not.toHaveBeenCalled();
  });

  it('allows an override within the caller own organization', async () => {
    const { service, calls } = buildService({ interviewOrg: ORG, decisionOutcome: 'FAIL' });

    await service.overrideDecision(
      'interview-1',
      'user-1',
      { newOutcome: 'PASS', reason: 'r' } as never,
      ORG,
    );

    expect(calls.decisionOverrideCreate).toHaveBeenCalledTimes(1);
  });
});

describe('InterviewsService.createDecision tenant boundary', () => {
  it('refuses to create a decision for another organization', async () => {
    const { service, calls } = buildService({ interviewOrg: OTHER_ORG });

    await expect(
      service.createDecision('interview-1', { outcome: 'PASS' } as never, ORG),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(calls.decisionCreate).not.toHaveBeenCalled();
  });

  it('allows creation inside the caller own organization', async () => {
    const { service, calls } = buildService({
      interviewOrg: ORG,
      decisionExists: false,
    });
    // createDecision requires at least one score row.
    (service as unknown as { prisma: { score: { findMany: jest.Mock } } }).prisma.score.findMany = jest.fn(
      async () => [{ overallScore: 8, maxScore: 10 }],
    );

    await service.createDecision('interview-1', { outcome: 'PASS' } as never, ORG);

    expect(calls.decisionCreate).toHaveBeenCalledTimes(1);
  });
});
