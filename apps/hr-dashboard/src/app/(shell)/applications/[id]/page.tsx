"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, MessageSquareText, Scale, UserCheck, XCircle } from "lucide-react";
import { AINote, DisagreementBadge, ModelComparison, type ModelRun } from "@repo/ui/ai";
import { Alert } from "@repo/ui/alert";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { ChatBubble } from "@repo/ui/chat";
import { ConfirmDialog } from "@repo/ui/confirm-dialog";
import { EmptyState } from "@repo/ui/empty-state";
import { Field } from "@repo/ui/field";
import { Textarea } from "@repo/ui/input";
import { PageHeader } from "@repo/ui/page-header";
import { ScoreBar, ScoreRing } from "@repo/ui/score";
import { Skeleton } from "@repo/ui/skeleton";
import { StatusPill } from "@repo/ui/status-pill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { toast } from "@repo/ui/toast";
import { apiFetch, ApiError } from "@/lib/api";
import { errorMessage, formatDateTime, fullName } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

/** Above this gap (percentage points) the two models are treated as disagreeing — matches the backend rule. */
const DISAGREEMENT_THRESHOLD = 20;

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
  score: { overallScore: number; maxScore: number; reasoning: string | null; criteria: Criterion[] } | null;
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

interface Decision {
  outcome: "PASS" | "FAIL";
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
}

interface Review {
  application: { id: string; status: string; completedAt: string | null };
  candidate: { firstName: string; lastName: string; email: string };
  jobPosting: { title: string };
  interview: { id: string; status: string } | null;
  stages: Stage[];
  evaluations: Evaluation[];
  decision: Decision | null;
  totals: { totalScore: number; maxScore: number; percentage: number };
}

interface Conversation {
  messages: { id: string; role: string; content: string; createdAt: string }[];
}

function runsFor(review: Review, answerId: string): ModelRun[] {
  return review.evaluations
    .filter((e) => e.answerId === answerId)
    .map((e) => ({
      id: e.id,
      model: e.model ?? "unknown model",
      status: e.status,
      score: e.score === null ? null : Number(e.score),
      reasoning: e.reasoning,
    }));
}

function disagrees(runs: ModelRun[], max: number): boolean {
  const percents = runs
    .filter((r) => r.status === "COMPLETED" && r.score !== null)
    .map((r) => (max > 0 ? ((r.score as number) / max) * 100 : 0));
  return percents.length > 1 && Math.max(...percents) - Math.min(...percents) > DISAGREEMENT_THRESHOLD;
}

export default function ApplicationReviewPage() {
  const id = useParams<{ id: string }>()?.id ?? null;
  const { data: review, error, loading, refresh } = useResource(id, () =>
    apiFetch<Review>(`/applications/${id}/review`),
  );

  if (loading) return <ReviewSkeleton />;
  if (!review) {
    return (
      <EmptyState
        title="Couldn't open this application"
        description={error ?? "It may belong to another organization."}
        action={
          <Button variant="secondary" asChild>
            <Link href="/applications">Back to applications</Link>
          </Button>
        }
      />
    );
  }

  const questions = review.stages.flatMap((s) => s.questions);
  const unscored = questions.filter((q) => q.answer && !q.score).length;
  const unanswered = questions.filter((q) => !q.answer).length;
  const failedRuns = review.evaluations.filter((e) => e.status === "FAILED").length;
  const disputed = questions.filter(
    (q) => q.answer && q.score && disagrees(runsFor(review, q.answer.id), q.score.maxScore),
  ).length;
  const name = fullName(review.candidate);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            {/* POST /interviews/:id/decision leaves the application COMPLETED (bug list #9), so derive it. */}
            <StatusPill status={review.decision ? "DECIDED" : review.application.status} />
            {review.interview && <Badge variant="outline">Interview {review.interview.status.toLowerCase().replace("_", " ")}</Badge>}
          </>
        }
        title={name}
        description={`${review.jobPosting.title} · ${review.candidate.email}`}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-2 min-w-0 lg:order-1">
          <Tabs defaultValue="answers">
            <TabsList>
              <TabsTrigger value="answers">
                <Scale /> Answers &amp; scores
              </TabsTrigger>
              <TabsTrigger value="conversation">
                <MessageSquareText /> Conversation
              </TabsTrigger>
            </TabsList>
            <TabsContent value="answers" className="space-y-6">
              {review.stages.length === 0 ? (
                <EmptyState title="No interview yet" description="Answers and scores appear once the candidate starts." />
              ) : (
                review.stages.map((stage) => <StageSection key={stage.id} stage={stage} review={review} />)
              )}
            </TabsContent>
            <TabsContent value="conversation">
              {review.interview ? (
                <ConversationView interviewId={review.interview.id} candidateName={name} />
              ) : (
                <EmptyState title="No conversation yet" description="The transcript appears once the candidate starts." />
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="order-1 space-y-4 lg:sticky lg:top-20 lg:order-2">
          <Card>
            <CardContent className="flex items-center gap-5 p-5">
              <ScoreRing percent={review.totals.percentage} />
              <div className="min-w-0 space-y-1.5">
                <p className="tabular text-sm text-fg">
                  <span className="text-lg font-semibold">{review.totals.totalScore}</span> / {review.totals.maxScore} points
                </p>
                {(unscored > 0 || unanswered > 0) && (
                  <p className="text-[13px] text-muted-fg">Of scored questions only</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {unscored > 0 && <Badge variant="warning">{unscored} unscored</Badge>}
                  {unanswered > 0 && <Badge>{unanswered} unanswered</Badge>}
                  {disputed > 0 && <DisagreementBadge />}
                  {failedRuns > 0 && <Badge variant="danger">{failedRuns} model run{failedRuns > 1 ? "s" : ""} failed</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>
          <DecisionCard review={review} onChanged={refresh} />
        </aside>
      </div>
    </>
  );
}

function StageSection({ stage, review }: { stage: Stage; review: Review }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          <span className="tabular text-muted-fg">Stage {stage.order}</span> · {stage.name}
        </h2>
        <StageStatus status={stage.status} />
      </div>
      {stage.questions.map((question) => (
        <QuestionReview key={question.questionVersionId} question={question} review={review} />
      ))}
    </section>
  );
}

/** Stage statuses read differently from application statuses (COMPLETED ≠ awaiting decision). */
function StageStatus({ status }: { status: string }) {
  if (status === "COMPLETED") return <Badge variant="success" dot>Completed</Badge>;
  if (status === "IN_PROGRESS" || status === "STARTED") return <Badge variant="primary" dot>In progress</Badge>;
  return <Badge dot>Not started</Badge>;
}

function QuestionReview({ question, review }: { question: Question; review: Review }) {
  const { answer, score } = question;
  const runs = answer ? runsFor(review, answer.id) : [];

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <p className="font-medium leading-6 text-fg">
            <span className="tabular mr-2 text-muted-fg">Q{question.order}</span>
            {question.question}
          </p>
          {score ? (
            <span className="tabular shrink-0 font-mono text-sm font-semibold text-fg">
              {score.overallScore}/{score.maxScore}
            </span>
          ) : (
            <Badge variant={answer ? "warning" : "neutral"}>{answer ? "Not scored" : "Unanswered"}</Badge>
          )}
        </div>

        <blockquote className="rounded-md border-l-2 border-border-strong bg-surface-2 px-4 py-3 text-[15px] leading-6 text-fg">
          {answer?.content?.trim() ? (
            <span className="whitespace-pre-wrap">{answer.content}</span>
          ) : (
            <span className="italic text-muted-fg">No answer recorded.</span>
          )}
        </blockquote>

        {answer && !score && (
          <p className="flex items-center gap-1.5 text-[13px] text-warning">
            <AlertTriangle className="size-3.5" aria-hidden /> This question had no rubric in the pinned version, so it wasn&apos;t scored.
          </p>
        )}

        {score && (
          <div className="space-y-4">
            <ScoreBar label="Question score" score={score.overallScore} max={score.maxScore} showBand />
            {score.criteria.length > 0 && (
              <div className="space-y-3 border-l-2 border-border pl-4">
                {score.criteria.map((criterion) => (
                  <div key={criterion.name} className="space-y-1">
                    <ScoreBar label={criterion.name} score={criterion.score} max={criterion.maxScore} />
                    {criterion.reasoning && <p className="text-[13px] leading-5 text-muted-fg">{criterion.reasoning}</p>}
                  </div>
                ))}
              </div>
            )}
            {score.reasoning && <AINote>{score.reasoning}</AINote>}
          </div>
        )}

        {runs.length > 0 && score && (
          <ModelComparison runs={runs} max={score.maxScore} threshold={DISAGREEMENT_THRESHOLD} className="border-t border-border pt-4" />
        )}
      </CardContent>
    </Card>
  );
}

function ConversationView({ interviewId, candidateName }: { interviewId: string; candidateName: string }) {
  const { data, error, loading } = useResource(`conversation:${interviewId}`, () =>
    apiFetch<Conversation>(`/interviews/${interviewId}/conversation`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) return { messages: [] };
      throw e;
    }),
  );

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <Alert variant="danger" title="Couldn't load the conversation">{error}</Alert>;
  const messages = (data?.messages ?? []).filter((m) => m.role !== "SYSTEM");
  if (messages.length === 0) {
    return <EmptyState icon={MessageSquareText} title="No messages recorded" description="This interview has no conversation transcript." />;
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            role={message.role === "ASSISTANT" ? "ai" : "candidate"}
            author={message.role === "ASSISTANT" ? "AI interviewer" : candidateName}
          >
            {message.content}
          </ChatBubble>
        ))}
      </CardContent>
    </Card>
  );
}

function DecisionCard({ review, onChanged }: { review: Review; onChanged: () => Promise<void> }) {
  const { decision, interview } = review;
  const complete = interview?.status === "COMPLETED";

  async function record(outcome: "PASS" | "FAIL") {
    if (!interview) return;
    try {
      await apiFetch(`/interviews/${interview.id}/decision`, { method: "POST", body: JSON.stringify({ outcome }) });
      toast.success(`Decision recorded: ${outcome === "PASS" ? "Pass" : "Fail"}`);
      await onChanged();
    } catch (e) {
      toast.error("Couldn't record the decision", errorMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {decision ? (
          <>
            <div
              className={`flex items-center gap-3 rounded-lg p-3 ${decision.outcome === "PASS" ? "bg-success-subtle" : "bg-danger-subtle"}`}
            >
              {decision.outcome === "PASS" ? (
                <CheckCircle2 className="size-6 text-success" aria-hidden />
              ) : (
                <XCircle className="size-6 text-danger" aria-hidden />
              )}
              <div>
                <p className="font-semibold text-fg">{decision.outcome === "PASS" ? "Pass" : "Fail"}</p>
                <p className="tabular text-xs text-muted-fg">
                  {decision.totalScore}/{decision.maxScore} points · {formatDateTime(decision.decidedAt)}
                </p>
              </div>
            </div>
            {decision.reasoning && <p className="text-[13px] leading-5 text-muted-fg">{decision.reasoning}</p>}
            {decision.overrides.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Override history</h3>
                <ol className="space-y-2">
                  {decision.overrides.map((override, index) => (
                    <li key={index} className="rounded-md border border-border p-3 text-[13px]">
                      <p className="flex items-center gap-1.5 font-medium text-fg">
                        <UserCheck className="size-3.5 text-primary" aria-hidden />
                        {override.previousOutcome} → {override.newOutcome}
                      </p>
                      <p className="mt-1 text-fg">{override.reason}</p>
                      <p className="mt-1 text-xs text-muted-fg">
                        {override.overriddenBy?.name || override.overriddenBy?.email} · {formatDateTime(override.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {interview && <OverrideForm interviewId={interview.id} current={decision.outcome} onChanged={onChanged} />}
          </>
        ) : complete ? (
          <>
            <p className="text-sm text-muted-fg">
              The interview is complete. The AI records a recommendation once every answer is scored; you can also decide now.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ConfirmDialog
                trigger={
                  <Button variant="secondary">
                    <CheckCircle2 className="text-success" /> Pass
                  </Button>
                }
                title="Record a Pass?"
                description="The decision is audited under your name. It can be overridden later with a reason."
                confirmLabel="Record Pass"
                onConfirm={() => record("PASS")}
              />
              <ConfirmDialog
                trigger={
                  <Button variant="secondary">
                    <XCircle className="text-danger" /> Fail
                  </Button>
                }
                title="Record a Fail?"
                description="The decision is audited under your name. It can be overridden later with a reason."
                confirmLabel="Record Fail"
                destructive
                onConfirm={() => record("FAIL")}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-fg">A decision can be made once the interview is complete.</p>
        )}
      </CardContent>
    </Card>
  );
}

function OverrideForm({
  interviewId,
  current,
  onChanged,
}: {
  interviewId: string;
  current: "PASS" | "FAIL";
  onChanged: () => Promise<void>;
}) {
  const next = current === "PASS" ? "FAIL" : "PASS";
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 5) {
      setError("Explain the change in at least a few words. It's stored permanently.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/interviews/${interviewId}/decision/override`, {
        method: "POST",
        body: JSON.stringify({ newOutcome: next, reason: reason.trim() }),
      });
      toast.success(`Decision changed to ${next === "PASS" ? "Pass" : "Fail"}`, "The previous outcome is kept in the history.");
      setOpen(false);
      setReason("");
      await onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        Override to {next === "PASS" ? "Pass" : "Fail"}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-border p-3">
      <Field label={`Why change to ${next === "PASS" ? "Pass" : "Fail"}?`} required error={error} hint="Stored permanently in the audit trail.">
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={busy} variant={next === "FAIL" ? "destructive" : "primary"}>
          Confirm override
        </Button>
      </div>
    </form>
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
