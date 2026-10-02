import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeMetrics, type CaseResult } from '../metrics.js';

/**
 * The eval harness's numbers end up in a résumé and in docs, so the maths is
 * tested directly rather than trusted. A silent error here would produce
 * confident, wrong figures — the worst possible failure for this file.
 */

function provider(pct: number, crit: { id: string; score: number; maxScore: number }[] = []) {
  return {
    provider: 'test',
    model: 'test-model',
    overallScore: pct,
    maxScore: 100,
    pct,
    criteria: crit.map((c) => ({ ...c, name: c.id })),
    usage: {},
  };
}

function kase(
  id: string,
  level: string,
  band: [number, number],
  pcts: number[],
  criteria: { id: string; score: number; maxScore: number }[][] = [],
): CaseResult {
  return {
    id,
    questionId: 'q1',
    expectedLevel: level,
    band,
    midpoint: (band[0] + band[1]) / 2,
    results: pcts.map((p, i) => provider(p, criteria[i] ?? [])),
  };
}

describe('eval metrics', () => {
  it('computes MAE against the band midpoint, not the band edge', () => {
    // band 80-100 -> midpoint 90; scores 90 and 70 -> errors 0 and 20 -> MAE 10
    const m = computeMetrics(
      [kase('a', 'excellent', [80, 100], [90]), kase('b', 'excellent', [80, 100], [70])],
      1,
    );
    assert.equal(m.mae, 10);
  });

  it('counts in-band rate inclusively at both edges', () => {
    const m = computeMetrics(
      [
        kase('a', 'strong', [70, 92], [70]),
        kase('b', 'strong', [70, 92], [92]),
        kase('c', 'strong', [70, 92], [69]),
      ],
      1,
    );
    assert.equal(m.inBandRate, Number(((2 / 3) * 100).toFixed(2)));
  });

  it('excludes cases where every provider errored from accuracy', () => {
    // An errored case measures provider availability, not scoring quality; if it
    // were counted as a 0% score every outage would silently tank the MAE.
    const errored = kase('bad', 'excellent', [85, 100], [0]);
    errored.results[0].error = 'provider exploded';

    const m = computeMetrics([kase('ok', 'excellent', [85, 100], [90]), errored], 1);

    assert.equal(m.cases, 2);
    assert.equal(m.scoredCases, 1);
    assert.equal(m.providerErrorCases, 1);
    // band 85-100 -> midpoint 92.5, so a 90 is 2.5pp off.
    assert.equal(m.mae, 2.5);
    assert.equal(m.meanScorePct, 90);
  });

  it('reports agreement rate and mean gap for two providers', () => {
    const m = computeMetrics(
      [
        kase('a', 'strong', [70, 92], [80, 90]), // gap 10 -> agrees
        kase('b', 'strong', [70, 92], [50, 95]), // gap 45 -> disagrees
      ],
      2,
    );
    assert.ok(m.agreement);
    assert.equal(m.agreement.rate, 50);
    assert.equal(m.agreement.meanGapPct, 27.5);
    assert.equal(m.agreement.n, 2);
  });

  it('treats a gap exactly at the threshold as agreement', () => {
    const m = computeMetrics([kase('a', 'strong', [70, 92], [60, 80])], 2);
    assert.equal(m.agreement?.rate, 100);
  });

  it('reports no agreement metric for a single provider', () => {
    const m = computeMetrics([kase('a', 'strong', [70, 92], [80])], 1);
    assert.equal(m.agreement, null);
  });

  it('separates discriminating criteria from flat ones', () => {
    // clarity.max moves with answer quality; quality.max is always 100%.
    const criteria = (clarity: number) => [
      { id: 'clarity', score: clarity, maxScore: 100 },
      { id: 'flat', score: 100, maxScore: 100 },
    ];
    const m = computeMetrics(
      [
        kase('high', 'excellent', [85, 100], [90], [criteria(90)]),
        kase('low', 'poor', [0, 35], [20], [criteria(10)]),
      ],
      1,
    );

    const byId = Object.fromEntries(m.criteria.map((c) => [c.id, c]));
    assert.equal(byId.clarity.separationPct, 80);
    assert.equal(byId.flat.separationPct, 0);
    // Worst-separating criterion sorts first: that is the actionable row.
    assert.equal(m.criteria[0].id, 'flat');
  });

  it('labels criteria with their id so same-named criteria stay distinct', () => {
    const m = computeMetrics(
      [
        kase('h', 'excellent', [85, 100], [90], [[{ id: 'q1.comm', score: 90, maxScore: 100 }]]),
        kase('l', 'poor', [0, 35], [10], [[{ id: 'q1.comm', score: 10, maxScore: 100 }]]),
      ],
      1,
    );
    assert.equal(m.criteria[0].label, 'q1.comm (q1.comm)');
  });

  it('groups by expected level for the monotonicity check', () => {
    const m = computeMetrics(
      [
        kase('a', 'excellent', [85, 100], [90]),
        kase('b', 'poor', [0, 35], [10]),
        kase('c', 'poor', [0, 35], [30]),
      ],
      1,
    );
    // excellent band 85-100 (mid 92.5): 90 -> 2.5pp off
    assert.deepEqual(m.byLevel.excellent, { n: 1, meanPct: 90, meanAbsError: 2.5 });
    // poor band 0-35 (mid 17.5): 10 -> 7.5, 30 -> 12.5, mean 10
    assert.deepEqual(m.byLevel.poor, { n: 2, meanPct: 20, meanAbsError: 10 });
  });

  it('never divides by zero on an empty run', () => {
    const m = computeMetrics([], 1);
    assert.equal(m.mae, 0);
    assert.equal(m.inBandRate, 0);
    assert.equal(m.meanScorePct, 0);
  });

  it('does not divide by a zero criterion maxScore', () => {
    const m = computeMetrics(
      [
        kase('h', 'excellent', [85, 100], [90], [[{ id: 'z', score: 0, maxScore: 0 }]]),
        kase('l', 'poor', [0, 35], [10], [[{ id: 'z', score: 0, maxScore: 0 }]]),
      ],
      1,
    );
    assert.equal(Number.isNaN(m.criteria[0].separationPct), false);
  });
});
