/**
 * Metric computation for the offline scoring eval (master-note §7).
 *
 * Extracted from run.ts so the maths can be unit-tested without triggering a
 * full eval run as an import side effect — this is the part of the harness most
 * likely to be quietly wrong (division by zero, error cases leaking into
 * accuracy, a criterion that looks separating but is not).
 */

/** Percentage gap above which two models are considered to disagree. */
export const AGREEMENT_GAP_PCT = 20;

/** High-band cases drive the "separation" metric. */
export const HIGH_BAND_MIDPOINT = 70;
export const LOW_BAND_MIDPOINT = 50;

export interface ProviderCaseResult {
  provider: string;
  model: string;
  overallScore: number;
  maxScore: number;
  pct: number;
  criteria: { id: string; name: string; score: number; maxScore: number }[];
  usage: { totalTokens?: number };
  /** Provider calls consumed (1 = no retry). High counts indicate throttling. */
  attempts?: number;
  error?: string;
}

export interface CaseResult {
  id: string;
  questionId: string;
  expectedLevel: string;
  band: [number, number];
  midpoint: number;
  results: ProviderCaseResult[];
}

export const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export const round = (n: number, dp = 2): number => Number(n.toFixed(dp));

/** Below this share of successfully scored cases, metrics are not publishable. */
export const COMPLETENESS_MIN = 0.95;

/**
 * Decide whether a run produced publishable numbers.
 *
 * Both conditions matter. A deterministic fake provider measures its own hash
 * rather than model judgement; and a run where many cases errored reports
 * whatever survived, which looks equally confident while being biased toward
 * whichever calls happened to get through.
 */
export function isQuotable(input: {
  meaningful: boolean;
  scoredCases: number;
  cases: number;
  minCompleteness?: number;
}): { quotable: boolean; completeness: number; reason?: string } {
  const min = input.minCompleteness ?? COMPLETENESS_MIN;
  const completeness = input.cases > 0 ? input.scoredCases / input.cases : 0;

  if (!input.meaningful) {
    return {
      quotable: false,
      completeness,
      reason: 'fake provider — metrics describe the deterministic hash, not the model',
    };
  }
  if (completeness < min) {
    return {
      quotable: false,
      completeness,
      reason: `incomplete sample — ${input.scoredCases}/${input.cases} cases scored (need ${Math.round(min * 100)}%)`,
    };
  }
  return { quotable: true, completeness };
}

export interface EvalMetrics {
  cases: number;
  scoredCases: number;
  providerErrorCases: number;
  mae: number;
  inBandRate: number;
  meanScorePct: number;
  byLevel: Record<string, { n: number; meanPct: number; meanAbsError: number }>;
  agreement: { rate: number; meanGapPct: number; n: number } | null;
  criteria: {
    id: string;
    label: string;
    name: string;
    highN: number;
    lowN: number;
    meanAwardedHighPct: number;
    meanAwardedLowPct: number;
    separationPct: number;
  }[];
}

export function computeMetrics(
  cases: CaseResult[],
  providerCount: number,
): EvalMetrics {
  // Cases where every provider errored are excluded from accuracy — they
  // measure provider availability, not scoring quality.
  const usable = cases.filter((c) => c.results.every((r) => !r.error));
  const errorCount = cases.length - usable.length;

  // Accuracy is measured on the FIRST provider's score (the primary model).
  const primary = usable.map((c) => c.results[0]?.pct ?? 0);
  const absErrors = usable.map((c, i) => Math.abs(primary[i] - c.midpoint));
  const inBand = usable.map(
    (c, i) => primary[i] >= c.band[0] && primary[i] <= c.band[1],
  );

  // By-level breakdown: a good evaluator is monotonic, not just close on average.
  const byLevel: EvalMetrics['byLevel'] = {};
  for (const level of ['excellent', 'strong', 'adequate', 'weak', 'poor']) {
    const idx = usable
      .map((c, i) => [c, i] as const)
      .filter(([c]) => c.expectedLevel === level);
    if (!idx.length) continue;
    byLevel[level] = {
      n: idx.length,
      meanPct: round(mean(idx.map(([, i]) => primary[i]))),
      meanAbsError: round(mean(idx.map(([, i]) => absErrors[i]))),
    };
  }

  // Inter-model agreement (two providers only).
  let agreement: EvalMetrics['agreement'] = null;
  if (providerCount === 2) {
    const gaps = usable.map((c) =>
      Math.abs((c.results[0]?.pct ?? 0) - (c.results[1]?.pct ?? 0)),
    );
    agreement = {
      n: gaps.length,
      rate: round(
        (gaps.filter((g) => g <= AGREEMENT_GAP_PCT).length / (gaps.length || 1)) * 100,
      ),
      meanGapPct: round(mean(gaps)),
    };
  }

  // Per-criterion separation: mean awarded % on high-band cases minus low-band
  // cases. Near zero means the criterion is not discriminating between a strong
  // answer and a weak one — a rubric problem the raw score hides.
  const criterionStats = new Map<string, { name: string; high: number[]; low: number[] }>();
  for (const c of usable) {
    const isHigh = c.midpoint >= HIGH_BAND_MIDPOINT;
    const isLow = c.midpoint < LOW_BAND_MIDPOINT;
    if (!isHigh && !isLow) continue;
    for (const crit of c.results[0]?.criteria ?? []) {
      const entry = criterionStats.get(crit.id) ?? { name: crit.name, high: [], low: [] };
      const awardPct = crit.maxScore > 0 ? (crit.score / crit.maxScore) * 100 : 0;
      (isHigh ? entry.high : entry.low).push(awardPct);
      criterionStats.set(crit.id, entry);
    }
  }
  const criteria = [...criterionStats.entries()].map(([id, s]) => ({
    id,
    // Two questions can each define a criterion called "Communication"; show the
    // id prefix too or the report shows duplicate-looking rows with opposite
    // separations and reads like a bug.
    label: `${id} (${s.name})`,
    name: s.name,
    highN: s.high.length,
    lowN: s.low.length,
    meanAwardedHighPct: round(mean(s.high)),
    meanAwardedLowPct: round(mean(s.low)),
    separationPct: round(mean(s.high) - mean(s.low)),
  }));

  return {
    cases: cases.length,
    scoredCases: usable.length,
    providerErrorCases: errorCount,
    mae: round(mean(absErrors)),
    inBandRate: round((inBand.filter(Boolean).length / (usable.length || 1)) * 100),
    meanScorePct: round(mean(primary)),
    byLevel,
    agreement,
    criteria: criteria.sort((a, b) => a.separationPct - b.separationPct),
  };
}
