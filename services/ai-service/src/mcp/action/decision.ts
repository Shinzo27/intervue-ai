/**
 * Decision threshold logic (master-note §43).
 *
 * Kept as a pure function, separate from the tool wiring, so the PASS/FAIL
 * boundary is unit-testable without a backend. The AI produces a
 * *recommendation*; the persisted Decision is the same row, and any later human
 * change goes through the override endpoint and is preserved as a
 * DecisionOverride (§44).
 */

export const DEFAULT_PASS_THRESHOLD_PCT = 70;

export interface DecisionInput {
  /** Application-level totals, from the score summary. */
  totalScore: number;
  maxScore: number;
  /** Percentage points required to reach PASS. */
  thresholdPct?: number;
}

export interface DecisionOutcomeResult {
  outcome: 'PASS' | 'FAIL';
  percentage: number;
  thresholdPct: number;
  /** True when the application has no usable score (cannot recommend PASS). */
  unscored: boolean;
  reasoning: string;
}

/**
 * Convert application totals into a PASS/FAIL recommendation.
 *
 * An unscored application (no score rows, or maxScore 0) is never a PASS —
 * the AI must not manufacture a positive recommendation out of missing data.
 */
export function computeDecision(input: DecisionInput): DecisionOutcomeResult {
  const thresholdPct = input.thresholdPct ?? DEFAULT_PASS_THRESHOLD_PCT;

  if (!Number.isFinite(input.totalScore) || !Number.isFinite(input.maxScore) || input.maxScore <= 0) {
    return {
      outcome: 'FAIL',
      percentage: 0,
      thresholdPct,
      unscored: true,
      reasoning:
        'No usable application score (maxScore <= 0 or non-finite totals). ' +
        'Recommending FAIL — an unscored application cannot be recommended as a pass.',
    };
  }

  const percentage = (input.totalScore / input.maxScore) * 100;
  const passed = percentage >= thresholdPct;

  return {
    outcome: passed ? 'PASS' : 'FAIL',
    percentage: Number(percentage.toFixed(2)),
    thresholdPct,
    unscored: false,
    reasoning:
      `Application scored ${input.totalScore}/${input.maxScore} ` +
      `(${percentage.toFixed(2)}%) against a ${thresholdPct}% pass threshold → ${passed ? 'PASS' : 'FAIL'}.`,
  };
}
