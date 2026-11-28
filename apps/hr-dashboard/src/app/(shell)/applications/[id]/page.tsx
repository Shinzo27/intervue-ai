"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface Criterion {
  name: string;
  score: number;
  maxScore: number;
  reasoning: string | null;
}

interface Question {
  questionVersionId: string;
  order: number;
  question: string;
  type: string;
  answer: { id: string; type: string; content: string; submittedAt: string } | null;
  score: {
    overallScore: number;
    maxScore: number;
    reasoning: string | null;
    criteria: Criterion[];
  } | null;
}

interface Stage {
  id: string;
  order: number;
  status: string;
  name: string;
  questions: Question[];
}

interface Evaluation {
  id: string;
  answerId: string;
  model: string | null;
  status: string;
  score: number | string | null;
  reasoning: string | null;
  createdAt: string;
}

interface Review {
  application: { id: string; status: string; completedAt: string | null };
  candidate: { firstName: string; lastName: string; email: string };
  jobPosting: { title: string };
  interview: { id: string; status: string } | null;
  stages: Stage[];
  evaluations: Evaluation[];
  decision: {
    outcome: string;
    totalScore: number;
    maxScore: number;
    reasoning: string | null;
    decidedAt: string;
    overrides: {
      previousOutcome: string;
      newOutcome: string;
      reason: string;
      createdAt: string;
      overriddenBy: { name: string; email: string };
    }[];
  } | null;
  totals: { totalScore: number; maxScore: number; percentage: number };
}

export default function ApplicationReviewPage() {
  const params = useParams<{ id: string }>();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setReview(await apiFetch<Review>(`/applications/${params.id}/review`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load review");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="muted text-sm">Loading review…</p>;
  if (error)
    return (
      <div className="panel border-[var(--danger)] p-4 text-sm text-[var(--danger)]">
        {error}
      </div>
    );
  if (!review) return null;

  const pct = review.totals.percentage;
  const failedModels = review.evaluations.filter((e) => e.status === "FAILED");
  // A question can have an answer but no score (no rubric on the pinned snapshot) —
  // in that case `totals` only covers what could be scored, so say so instead of
  // letting a bare "100%" read as a perfect interview.
  const allQuestions = review.stages.flatMap((s) => s.questions);
  const unscored = allQuestions.filter((q) => q.answer && !q.score).length;
  const unanswered = allQuestions.filter((q) => !q.answer).length;
  const partial = unscored > 0 || unanswered > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <a href="/applications" className="muted text-xs hover:underline">
        ← Applications
      </a>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {review.candidate.firstName} {review.candidate.lastName}
          </h1>
          <p className="muted mt-1 text-sm">
            {review.jobPosting.title} · {review.candidate.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">{review.application.status}</span>
          {review.interview && (
            <span
              className={
                review.interview.status === "COMPLETED" ? "chip chip-pass" : "chip chip-warn"
              }
            >
              interview {review.interview.status}
            </span>
          )}
          <span className="chip">
            score {review.totals.totalScore}/{review.totals.maxScore} · {pct}%
            {partial ? " of scored" : ""}
          </span>
          {unscored > 0 && (
            <span className="chip chip-warn">
              {unscored} question{unscored > 1 ? "s" : ""} unscored
            </span>
          )}
          {unanswered > 0 && (
            <span className="chip chip-warn">
              {unanswered} unanswered
            </span>
          )}
          {failedModels.length > 0 && (
            <span className="chip chip-warn">
              {failedModels.length} model run{failedModels.length > 1 ? "s" : ""} failed
            </span>
          )}
        </div>
      </header>

      <DecisionPanel review={review} onChanged={load} />
      <ModelPanel evaluations={review.evaluations} />

      <section className="mt-6 space-y-4">
        {review.stages.map((stage) => (
          <StageCard key={stage.id} stage={stage} />
        ))}
      </section>
    </div>
  );
}

function StageCard({ stage }: { stage: Stage }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-sm font-medium">
          Stage {stage.order} · {stage.name}
        </span>
        <span className={stage.status === "COMPLETED" ? "chip chip-pass" : "chip"}>
          {stage.status}
        </span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {stage.questions.map((q) => (
          <QuestionRow key={q.questionVersionId} q={q} />
        ))}
      </div>
    </div>
  );
}

function QuestionRow({ q }: { q: Question }) {
  const score = q.score;
  const pctScore = score && score.maxScore > 0 ? (score.overallScore / score.maxScore) * 100 : 0;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium">
          Q{q.order}. {q.question}
        </p>
        {score ? (
          <span className={pctScore >= 70 ? "chip chip-pass" : "chip chip-warn"}>
            {score.overallScore}/{score.maxScore}
          </span>
        ) : (
          <span className="chip">unscored</span>
        )}
      </div>

      <div className="panel-2 mt-3 p-3">
        <div className="muted mb-1 text-[11px] uppercase tracking-wide">Answer</div>
        <p className="text-sm whitespace-pre-wrap">
          {q.answer?.content?.trim() ? q.answer.content : <em className="muted">no answer recorded</em>}
        </p>
      </div>

      {score && (
        <div className="mt-3 space-y-2">
          {score.criteria.length === 0 ? (
            <p className="muted text-xs">
              No criterion breakdown stored for this score.
            </p>
          ) : (
            score.criteria.map((c) => {
              const pct = c.maxScore > 0 ? (c.score / c.maxScore) * 100 : 0;
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{c.name}</span>
                    <span className="muted">
                      {c.score}/{c.maxScore}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.max(2, Math.min(100, pct))}%`,
                        background: pct >= 70 ? "var(--success)" : "var(--warning)",
                      }}
                    />
                  </div>
                  {c.reasoning && (
                    <p className="muted mt-1 text-[11px] leading-relaxed">{c.reasoning}</p>
                  )}
                </div>
              );
            })
          )}
          {score.reasoning && (
            <p className="muted text-xs leading-relaxed">{score.reasoning}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Two-model panel: every AI evaluation run for this interview. */
function ModelPanel({ evaluations }: { evaluations: Evaluation[] }) {
  const scores = evaluations
    .filter((e) => e.status === "COMPLETED")
    .map((e) => Number(e.score ?? 0));
  const gap =
    scores.length > 1 ? Math.abs(Math.max(...scores) - Math.min(...scores)) : null;

  return (
    <section className="panel mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-sm font-medium">AI evaluations (two-model panel)</span>
        {gap === null ? (
          <span className="chip">single model</span>
        ) : (
          <span className={gap > 2 ? "chip chip-warn" : "chip chip-pass"}>
            Δ {gap} pts between models
          </span>
        )}
      </div>

      {evaluations.length === 0 ? (
        <p className="muted p-4 text-sm">No evaluations recorded for this interview.</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Model</th>
              <th>Status</th>
              <th>Score</th>
              <th>Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((e) => (
              <tr key={e.id}>
                <td className="text-xs">{e.model ?? "—"}</td>
                <td>
                  <span
                    className={
                      e.status === "COMPLETED"
                        ? "chip chip-pass"
                        : e.status === "FAILED"
                          ? "chip chip-fail"
                          : "chip chip-warn"
                    }
                  >
                    {e.status}
                  </span>
                </td>
                <td className="text-xs">{e.score === null ? "—" : String(e.score)}</td>
                <td className="muted max-w-md text-xs">{(e.reasoning ?? "").slice(0, 160)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Decision + human override (reason required, history preserved). */
function DecisionPanel({ review, onChanged }: { review: Review; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<"PASS" | "FAIL">(
    review.decision?.outcome === "PASS" ? "FAIL" : "PASS",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const decision = review.decision;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!review.interview) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/interviews/${review.interview.id}/decision/override`, {
        method: "POST",
        body: JSON.stringify({ newOutcome: outcome, reason }),
      });
      setOpen(false);
      setReason("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-sm font-medium">Decision</span>
        {decision ? (
          <span className={decision.outcome === "PASS" ? "chip chip-pass" : "chip chip-fail"}>
            {decision.outcome}
          </span>
        ) : (
          <span className="chip">not decided</span>
        )}
      </div>

      <div className="p-4">
        {decision ? (
          <>
            <p className="text-sm">
              Total {decision.totalScore}/{decision.maxScore} · decided{" "}
              {new Date(decision.decidedAt).toLocaleString()}
            </p>
            {decision.reasoning && (
              <p className="muted mt-2 text-xs leading-relaxed">{decision.reasoning}</p>
            )}

            {decision.overrides.length > 0 && (
              <div className="mt-4">
                <div className="muted mb-2 text-[11px] uppercase tracking-wide">
                  Override history
                </div>
                <div className="space-y-2">
                  {decision.overrides.map((o, i) => (
                    <div key={i} className="panel-2 p-3 text-xs">
                      <span className="chip chip-warn">
                        {o.previousOutcome} → {o.newOutcome}
                      </span>
                      <p className="mt-2">{o.reason}</p>
                      <p className="muted mt-1 text-[11px]">
                        {o.overriddenBy?.name ?? o.overriddenBy?.email} ·{" "}
                        {new Date(o.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {review.interview && (
              <button
                onClick={() => setOpen((v) => !v)}
                className="mt-4 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-2)]"
              >
                {open ? "Cancel override" : "Override decision"}
              </button>
            )}

            {open && (
              <form onSubmit={submit} className="panel-2 mt-3 space-y-3 p-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="muted">New outcome</span>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as "PASS" | "FAIL")}
                    className="panel px-2 py-1 text-xs"
                  >
                    <option value="PASS">PASS</option>
                    <option value="FAIL">FAIL</option>
                  </select>
                </div>
                <textarea
                  required
                  minLength={5}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is the AI decision wrong? This is stored permanently."
                  className="panel w-full px-3 py-2 text-xs"
                  rows={3}
                />
                {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--on-primary)] disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Confirm override"}
                </button>
              </form>
            )}
          </>
        ) : (
          <p className="muted text-sm">
            No decision yet — the AI creates one from aggregated scores once the
            interview is complete and every question is scored.
          </p>
        )}
      </div>
    </section>
  );
}
