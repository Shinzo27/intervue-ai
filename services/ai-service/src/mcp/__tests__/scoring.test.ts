import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createFakeProvider } from '../../llm/provider.js';
import { mergeCriteria, pctOf, type CompletedEval } from '../../scoring/types.js';
import type { EvaluationRequest } from '../../llm/provider.js';

const REQ: EvaluationRequest = {
  question: 'Explain SQL vs NoSQL.',
  questionType: 'TEXT',
  options: [],
  rubricCriteria: [
    { id: 'c1', name: 'Database fundamentals', description: null, maxScore: 5 },
    { id: 'c2', name: 'Clarity', description: null, maxScore: 3 },
  ],
  answerType: 'TEXT',
  answerContent:
    'SQL databases are relational with fixed schemas and strong consistency; ' +
    'NoSQL trades schema rigidity for horizontal scale and flexible schemas.',
};

describe('fake provider', () => {
  it('returns a valid evaluation that respects rubric maxima', async () => {
    const provider = createFakeProvider();
    const res = await provider.evaluate(REQ);
    assert.equal(res.provider, 'fake');
    assert.ok(res.result.criteria.length === 2);
    for (const c of res.result.criteria) {
      assert.ok(c.score >= 0 && c.score <= c.maxScore, `score in range: ${JSON.stringify(c)}`);
    }
    assert.equal(res.result.maxScore, 8);
    assert.ok(res.result.overallScore <= res.result.maxScore);
    // deterministic: same input → same output
    const again = await provider.evaluate(REQ);
    assert.equal(again.result.overallScore, res.result.overallScore);
  });

  it('handles empty answers gracefully', async () => {
    const provider = createFakeProvider();
    const res = await provider.evaluate({ ...REQ, answerContent: '' });
    assert.ok(res.result.criteria.length === 2);
    assert.ok(res.result.overallScore >= 0);
  });
});

describe('two-model aggregation helpers', () => {
  const mk = (score: number, max: number, provider = 'a'): CompletedEval => ({
    provider,
    evaluationId: 'e',
    result: {
      criteria: [
        { rubricCriterionVersionId: 'c1', name: 'A', score: Math.round(score / 2), maxScore: 5, reasoning: 'r1' },
        { rubricCriterionVersionId: 'c2', name: 'B', score: score - Math.round(score / 2), maxScore: 3, reasoning: 'r2' },
      ],
      overallScore: score,
      maxScore: max,
      reasoning: 'why',
    },
  });

  it('pctOf computes percentage', () => {
    assert.equal(pctOf(mk(4, 8)), 50);
  });

  it('mergeCriteria averages overlapping criteria and tags providers', () => {
    const merged = mergeCriteria(mk(6, 8, 'p1').result.criteria, mk(4, 8, 'p2').result.criteria, 'p1', 'p2');
    const c1 = merged.find((c) => c.rubricCriterionVersionId === 'c1');
    assert.equal(c1.score, (mk(6, 8, 'p1').result.criteria[0].score + mk(4, 8, 'p2').result.criteria[0].score) / 2);
    assert.ok(c1.reasoning.includes('[p1]') && c1.reasoning.includes('[p2]'));
  });

  it('gap computation branches consensus vs disagreement', () => {
    const a = mk(6, 8);  // 75%
    const close = mk(7, 8);  // 87.5% → gap 12.5 ≤ 20 → consensus
    const far = mk(2, 8);    // 25% → gap 50 > 20 → disagreement
    assert.equal(Math.abs(pctOf(a) - pctOf(close)) <= 20, true);
    assert.equal(Math.abs(pctOf(a) - pctOf(far)) <= 20, false);
  });
});
