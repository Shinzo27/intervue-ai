/**
 * Offline scoring eval harness (master-note §7).
 *
 * Runs the golden answer set through the SAME providers the scoring pipeline
 * uses, with no backend and no MCP involved, and reports:
 *
 *   - MAE vs the expected band midpoint (percentage points)
 *   - in-band rate (how often the score landed inside the expected band)
 *   - inter-model agreement rate + mean gap (two-model configuration only)
 *   - per-criterion separation: does each rubric criterion actually
 *     discriminate strong answers from weak ones?
 *
 * Run: pnpm eval
 *
 * HONESTY RULE — the point of this file
 * ------------------------------------
 * The deterministic `fake` provider scores by hashing the answer text. Metrics
 * computed against it measure the hash function, NOT model judgement: a low MAE
 * there would be meaningless and quoting it would be dishonest. So when every
 * configured provider is `fake`, the run is labelled a SMOKE run, the metrics
 * are marked `meaningful: false`, and the CLI says so loudly instead of
 * presenting them as eval results.
 *
 * Metric maths lives in ./metrics.ts so it can be unit-tested without running
 * a full eval as an import side effect.
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// LLM-only env: this harness is fully offline and must not require a backend URL.
import { loadLlmEnv } from '../src/config/env.js';
import { buildPrimaryProvider, buildSecondaryProvider } from '../src/llm/factory.js';
import type { LlmProvider, EvaluationRequest } from '../src/llm/provider.js';
import {
  AGREEMENT_GAP_PCT,
  computeMetrics,
  type CaseResult,
  type ProviderCaseResult,
} from './metrics.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, 'fixtures.json');
const REPORT_JSON = resolve(HERE, 'report.json');
const REPORT_MD = resolve(HERE, 'report.md');

/** Politeness limit for real API providers. */
const CONCURRENCY = 4;

interface MetricFixture {
  id: string;
  questionId: string;
  question: string;
  questionType: string;
  options: { id: string; text: string }[];
  rubricCriteria: { id: string; name: string; description: string; maxScore: number }[];
  answerType: string;
  answer: string;
  expectedLevel: string;
  expectedBandPct: [number, number];
}

/** Run `fn` over items with a fixed concurrency ceiling. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function toRequest(f: MetricFixture): EvaluationRequest {
  return {
    question: f.question,
    questionType: f.questionType,
    options: (f.options ?? []).map((o, i) => ({ id: o.id, text: o.text, order: i + 1 })),
    rubricCriteria: f.rubricCriteria.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      maxScore: c.maxScore,
    })),
    answerType: f.answerType,
    answerContent: f.answer,
  };
}

async function runCase(f: MetricFixture, providers: LlmProvider[]): Promise<CaseResult> {
  const request = toRequest(f);
  const midpoint = (f.expectedBandPct[0] + f.expectedBandPct[1]) / 2;

  const results = await Promise.all(
    providers.map(async (p): Promise<ProviderCaseResult> => {
      try {
        const res = await p.evaluate(request);
        const maxScore = res.result.maxScore > 0 ? res.result.maxScore : 1;
        return {
          provider: p.name,
          model: res.model,
          overallScore: res.result.overallScore,
          maxScore: res.result.maxScore,
          pct: (res.result.overallScore / maxScore) * 100,
          criteria: res.result.criteria.map((c) => ({
            id: c.rubricCriterionVersionId,
            name: c.name,
            score: c.score,
            maxScore: c.maxScore,
          })),
          usage: { totalTokens: res.usage.totalTokens },
        };
      } catch (error) {
        return {
          provider: p.name,
          model: p.model,
          overallScore: 0,
          maxScore: 0,
          pct: 0,
          criteria: [],
          usage: {},
          error: error instanceof Error ? error.message.slice(0, 200) : String(error),
        };
      }
    }),
  );

  return {
    id: f.id,
    questionId: f.questionId,
    expectedLevel: f.expectedLevel,
    band: f.expectedBandPct,
    midpoint,
    results,
  };
}

function buildMarkdown(
  report: { generatedAt: string },
  metrics: ReturnType<typeof computeMetrics>,
  meaningful: boolean,
): string {
  return [
    '# Scoring eval report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    meaningful
      ? '> Real providers configured.'
      : '> **SMOKE RUN (fake provider).** These numbers measure the deterministic hash, not model judgement. Do not quote them.',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Cases | ${metrics.cases} |`,
    `| MAE vs band midpoint | ${metrics.mae} pp |`,
    `| In-band rate | ${metrics.inBandRate}% |`,
    `| Mean score | ${metrics.meanScorePct}% |`,
    `| Model agreement | ${
      metrics.agreement
        ? `${metrics.agreement.rate}% (mean gap ${metrics.agreement.meanGapPct} pp)`
        : 'n/a (single model)'
    } |`,
    '',
    '## By expected level',
    '',
    '| Level | n | Mean score | MAE |',
    '|---|---|---|---|',
    ...Object.entries(metrics.byLevel).map(
      ([level, s]) => `| ${level} | ${s.n} | ${s.meanPct}% | ${s.meanAbsError} pp |`,
    ),
    '',
    '## Per-criterion separation',
    '',
    '| Criterion | High-band mean % | Low-band mean % | Separation |',
    '|---|---|---|---|',
    ...metrics.criteria.map(
      (c) =>
        `| ${c.label} | ${c.meanAwardedHighPct} | ${c.meanAwardedLowPct} | ${c.separationPct} pp |`,
    ),
    '',
  ].join('\n');
}

async function main() {
  const env = loadLlmEnv();
  const primary = buildPrimaryProvider(env);
  const secondary = buildSecondaryProvider(env);
  const providers = [primary, ...(secondary ? [secondary] : [])];

  const meaningful = providers.some((p) => p.name !== 'fake');

  const fixtures = JSON.parse(readFileSync(FIXTURES, 'utf8')) as {
    version: number;
    cases: MetricFixture[];
  };

  console.log(`[eval] fixtures: ${fixtures.cases.length} cases (v${fixtures.version})`);
  console.log(`[eval] providers: ${providers.map((p) => `${p.name}:${p.model}`).join(', ')}`);
  if (!meaningful) {
    console.log('');
    console.log('  !! SMOKE RUN — the `fake` provider scores by hashing the answer text.');
    console.log('  !! These metrics measure that hash, NOT model judgement, and must not');
    console.log('  !! be quoted as eval results. Set LLM_PROVIDER (and a key) for real numbers.');
    console.log('');
  }

  const started = Date.now();
  const cases = await pool(fixtures.cases, CONCURRENCY, (f) => runCase(f, providers));
  const metrics = computeMetrics(cases, providers.length);

  const report = {
    generatedAt: new Date().toISOString(),
    meaningful,
    smokeRun: !meaningful,
    providers: providers.map((p) => ({ name: p.name, model: p.model })),
    fixturesVersion: fixtures.version,
    agreementGapPct: AGREEMENT_GAP_PCT,
    durationMs: Date.now() - started,
    metrics,
    cases,
  };

  mkdirSync(HERE, { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(REPORT_MD, buildMarkdown(report, metrics, meaningful));

  console.log('');
  console.log(`[eval] MAE vs band midpoint : ${metrics.mae} pp`);
  console.log(`[eval] in-band rate         : ${metrics.inBandRate}%`);
  console.log(`[eval] mean score           : ${metrics.meanScorePct}%`);
  if (metrics.agreement) {
    console.log(
      `[eval] model agreement      : ${metrics.agreement.rate}% (mean gap ${metrics.agreement.meanGapPct} pp)`,
    );
  }
  if (metrics.providerErrorCases > 0) {
    console.log(`[eval] provider errors      : ${metrics.providerErrorCases} case(s)`);
  }
  console.log('');
  console.log('[eval] by expected level (monotonic = a healthy evaluator):');
  for (const [level, s] of Object.entries(metrics.byLevel)) {
    console.log(
      `  ${level.padEnd(10)} n=${String(s.n).padStart(2)}  mean=${String(s.meanPct).padStart(6)}%  MAE=${s.meanAbsError} pp`,
    );
  }
  console.log('');
  console.log('[eval] per-criterion separation (high-band minus low-band awarded %):');
  for (const c of metrics.criteria) {
    console.log(`  ${c.label.padEnd(34)} ${String(c.separationPct).padStart(7)} pp`);
  }

  console.log('');
  console.log(`[eval] wrote ${REPORT_JSON}`);
  console.log(`[eval] wrote ${REPORT_MD}`);
  console.log(
    meaningful
      ? '[eval] these numbers are quotable — record them in docs/ai.md §9'
      : '[eval] NOT quotable (smoke run) — add a provider key for real metrics',
  );
}

main().catch((error) => {
  console.error('[eval] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
