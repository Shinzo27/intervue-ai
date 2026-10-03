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
  isQuotable,
  type CaseResult,
  type ProviderCaseResult,
} from './metrics.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, 'fixtures.json');
const REPORT_JSON = resolve(HERE, 'report.json');
const REPORT_MD = resolve(HERE, 'report.md');

/**
 * Politeness limit for real API providers. Lower it when a provider caps
 * output tokens per minute (free tiers often cap hard): concurrency above the
 * provider's limit just converts into 429s and a shrunken sample.
 */
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 2);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Providers report limits in the message body rather than Retry-After. */
function retryDelayMs(message: string, fallback: number): number {
  const m = /try again in ([\d.]+)s|retry[- ]?after[:\s]+([\d.]+)/i.exec(message);
  const seconds = m ? Number(m[1] ?? m[2]) : NaN;
  return Number.isFinite(seconds)
    ? Math.min(90_000, seconds * 1000 + 250)
    : Math.min(30_000, fallback);
}

const RETRYABLE = /429|rate limit|too many requests|overloaded|\b5\d\d\b|timeout|ECONNRESET|ETIMEDOUT/i;

/** Call a provider with bounded exponential backoff. Returns the attempt count. */
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 6,
): Promise<{ value: T; attempts: number }> {
  let delay = 1500;
  for (let attempt = 1; ; attempt++) {
    try {
      return { value: await fn(), attempts: attempt };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!RETRYABLE.test(message) || attempt >= maxAttempts) throw error;
      await sleep(retryDelayMs(message, delay) + Math.random() * 400);
      delay *= 2;
    }
  }
}

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
        const { value: res, attempts } = await callWithRetry(() => p.evaluate(request));
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
          attempts,
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
  quotable: boolean,
  meaningful: boolean,
): string {
  return [
    '# Scoring eval report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    quotable
      ? '> Real providers configured; sample complete. Quotable.'
      : meaningful
        ? `> **INCOMPLETE RUN — only ${metrics.scoredCases}/${metrics.cases} cases scored.** Metrics cover the survivors only and are biased. Do not quote them.`
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
  if (providers.length === 2) {
    const sameProvider = providers[0].name === providers[1].name;
    console.log(
      sameProvider
        ? '[eval] diversity: MODEL-level only (both models share one provider) — ' +
            'disagreement here is not provider-level corroboration'
        : '[eval] diversity: PROVIDER-level (two independent providers)',
    );
  }
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

  // Errored cases drop out of the metrics entirely, so a partial run reports
  // whatever survived — 13 of 36 cases still yields a confident-looking MAE,
  // just on a biased subsample. See isQuotable().
  const verdict = isQuotable({
    meaningful,
    scoredCases: metrics.scoredCases,
    cases: metrics.cases,
  });
  const { quotable, completeness } = verdict;

  const report = {
    generatedAt: new Date().toISOString(),
    meaningful,
    quotable,
    smokeRun: !meaningful,
    completenessPct: Number((completeness * 100).toFixed(2)),
    providers: providers.map((p) => ({ name: p.name, model: p.model })),
    fixturesVersion: fixtures.version,
    agreementGapPct: AGREEMENT_GAP_PCT,
    durationMs: Date.now() - started,
    metrics,
    cases,
  };

  mkdirSync(HERE, { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(REPORT_MD, buildMarkdown(report, metrics, quotable, meaningful));

  console.log('');
  console.log(`[eval] MAE vs band midpoint : ${metrics.mae} pp`);
  console.log(`[eval] in-band rate         : ${metrics.inBandRate}%`);
  console.log(`[eval] mean score           : ${metrics.meanScorePct}%`);
  if (metrics.agreement) {
    console.log(
      `[eval] model agreement      : ${metrics.agreement.rate}% (mean gap ${metrics.agreement.meanGapPct} pp)`,
    );
  }
  console.log(`[eval] scored cases         : ${metrics.scoredCases}/${metrics.cases} (${(completeness * 100).toFixed(1)}%)`);
  if (metrics.providerErrorCases > 0) {
    console.log(`[eval] provider errors      : ${metrics.providerErrorCases} case(s)`);
    const reasons = cases
      .filter((c) => c.results.some((r) => r.error))
      .map((c) => c.results.find((r) => r.error)?.error ?? '')
      .slice(0, 3);
    for (const r of reasons) console.log(`         e.g. ${r.slice(0, 140)}`);
  }
  if (meaningful && !quotable) {
    console.log('');
    console.log(`  !! INCOMPLETE RUN — only ${(completeness * 100).toFixed(1)}% of cases scored.`);
    console.log('  !! Metrics are computed over the survivors only, so they are biased');
    console.log('  !! and must NOT be published as a baseline. Lower EVAL_CONCURRENCY or');
    console.log('  !! use providers with a higher rate limit.');
    console.log('');
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
    quotable
      ? '[eval] these numbers are quotable — record them in docs/ai.md §9'
      : meaningful
        ? '[eval] NOT quotable — incomplete sample (see above)'
        : '[eval] NOT quotable (smoke run) — add a provider key for real metrics',
  );
}

main().catch((error) => {
  console.error('[eval] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
