import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AI_CAPABILITIES,
  FORBIDDEN_CAPABILITIES,
  assertPermission,
  buildAuditMetadata,
  checkPermission,
  type ActorContext,
} from '../action/permissions.js';
import { computeDecision, DEFAULT_PASS_THRESHOLD_PCT } from '../action/decision.js';

const actor: ActorContext = {
  actorType: 'AI',
  actorId: 'ai-service',
  tool: 'test-tool',
  traceId: 'trace-1',
};

describe('permission matrix', () => {
  it('forbids decision:override unconditionally', () => {
    const decision = checkPermission({ capability: 'decision:override', actor });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'CAPABILITY_FORBIDDEN');
    // The prohibition must be independent of any org hint the caller supplies.
    const withOrg = checkPermission({
      capability: 'decision:override',
      actor: { ...actor, organizationIdHint: 'org-1' },
      expectedOrganizationId: 'org-1',
      resourceOrganizationId: 'org-1',
    });
    assert.equal(withOrg.allowed, false);
    assert.equal(withOrg.code, 'CAPABILITY_FORBIDDEN');
  });

  it('rejects capabilities that are not in the grant table', () => {
    // Deny-by-default: a capability that is not explicitly granted is refused,
    // even when it looks like something a tool might plausibly want.
    const decision = checkPermission({
      capability: 'organization:delete' as never,
      actor,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'CAPABILITY_NOT_GRANTED');
  });

  it('allows every granted capability', () => {
    for (const capability of AI_CAPABILITIES) {
      assert.equal(
        checkPermission({ capability, actor }).allowed,
        true,
        `expected ${capability} to be allowed`,
      );
    }
  });

  it('never grants a forbidden capability even if the grant list contains it', () => {
    // Structural guard: the forbidden list wins over any grant-table edit.
    assert.ok(FORBIDDEN_CAPABILITIES.includes('decision:override'));
    assert.ok(!AI_CAPABILITIES.includes('decision:override'));
  });

  it('blocks cross-organization access', () => {
    const decision = checkPermission({
      capability: 'interview:advance',
      actor: { ...actor, organizationIdHint: 'org-a' },
      expectedOrganizationId: 'org-a',
      resourceOrganizationId: 'org-b',
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'ORG_MISMATCH');
  });

  it('allows same-organization access', () => {
    const decision = checkPermission({
      capability: 'interview:advance',
      actor: { ...actor, organizationIdHint: 'org-a' },
      expectedOrganizationId: 'org-a',
      resourceOrganizationId: 'org-a',
    });
    assert.equal(decision.allowed, true);
  });

  it('skips the org check when no org is asserted', () => {
    assert.equal(
      checkPermission({ capability: 'interview:complete', actor }).allowed,
      true,
    );
  });

  it('assertPermission throws with the rejection code', () => {
    assert.throws(
      () =>
        assertPermission({
          capability: 'decision:override',
          actor,
        }),
      /permanently forbidden/,
    );
  });

  it('audit metadata carries tool, actor, capability and trace', () => {
    const meta = buildAuditMetadata({
      actor,
      capability: 'decision:recommend',
      traceId: 'trace-9',
      extra: { outcome: 'PASS' },
    });
    assert.equal(meta.tool, 'test-tool');
    assert.equal(meta.actorType, 'AI');
    assert.equal(meta.actorId, 'ai-service');
    assert.equal(meta.capability, 'decision:recommend');
    assert.equal(meta.traceId, 'trace-9');
    assert.equal(meta.outcome, 'PASS');
  });
});

describe('decision threshold', () => {
  it('passes at or above the default threshold', () => {
    const result = computeDecision({ totalScore: 70, maxScore: 100 });
    assert.equal(result.outcome, 'PASS');
    assert.equal(result.thresholdPct, DEFAULT_PASS_THRESHOLD_PCT);
    assert.equal(result.percentage, 70);
    assert.equal(result.unscored, false);
  });

  it('fails just below the threshold', () => {
    assert.equal(computeDecision({ totalScore: 69, maxScore: 100 }).outcome, 'FAIL');
  });

  it('honours a custom threshold', () => {
    assert.equal(
      computeDecision({ totalScore: 50, maxScore: 100, thresholdPct: 40 }).outcome,
      'PASS',
    );
    assert.equal(
      computeDecision({ totalScore: 80, maxScore: 100, thresholdPct: 90 }).outcome,
      'FAIL',
    );
  });

  it('never passes an unscored application', () => {
    const zero = computeDecision({ totalScore: 0, maxScore: 0 });
    assert.equal(zero.outcome, 'FAIL');
    assert.equal(zero.unscored, true);

    const nan = computeDecision({ totalScore: Number.NaN, maxScore: 100 });
    assert.equal(nan.outcome, 'FAIL');
    assert.equal(nan.unscored, true);
  });

  it('handles fractional totals from two-model averaging', () => {
    const result = computeDecision({ totalScore: 8.5, maxScore: 10 });
    assert.equal(result.outcome, 'PASS');
    assert.equal(result.percentage, 85);
  });
});
