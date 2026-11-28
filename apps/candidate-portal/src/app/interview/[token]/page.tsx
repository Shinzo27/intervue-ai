"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Link2Off,
  MessageSquareText,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  TimerOff,
  UserCheck,
  WifiOff,
} from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { ChatBubble, Composer, TypingIndicator } from "@repo/ui/chat";
import { Checkbox } from "@repo/ui/checkbox";
import { Field } from "@repo/ui/field";
import { Progress } from "@repo/ui/progress";
import { Spinner } from "@repo/ui/spinner";
import { ThemeToggle } from "@repo/ui/theme-toggle";

interface Access {
  interviewId: string;
  candidate: { name: string };
  job: { title: string };
  status: string;
  currentStage: { id: string; order: number; status: string } | null;
}

interface TurnResult {
  interviewId: string;
  reply: string;
  fallback: boolean;
  stageCompleted: boolean;
  interviewCompleted: boolean;
  answerId: string | null;
  progress: {
    answeredQuestions: number;
    totalQuestions: number;
    totalStages: number;
    completedStages: number;
  };
  currentQuestion: string | null;
}

interface Bubble {
  id: number;
  role: "ai" | "me" | "divider";
  text: string;
}

type LinkProblem = "invalid" | "expired" | "connection";
type Phase = "loading" | "intro" | "chat" | "complete" | "problem";

class LinkError extends Error {
  constructor(readonly kind: LinkProblem) {
    super(kind);
  }
}

function problemFor(status: number): LinkProblem {
  if (status === 403) return "expired";
  if (status === 401 || status === 404) return "invalid";
  return "connection";
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(json?.error?.message ?? json?.message ?? `${res.status}`);
  return json;
}

export default function InterviewPage() {
  const token = useParams<{ token: string }>()?.token;

  const [phase, setPhase] = useState<Phase>("loading");
  const [problem, setProblem] = useState<LinkProblem>("invalid");
  const [attempt, setAttempt] = useState(0);
  const [access, setAccess] = useState<Access | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [progress, setProgress] = useState<TurnResult["progress"] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingId, setStreamingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  /** Load the interview behind the invite token; resume the transcript if already started. */
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/backend/interviews/access/${token}`, { cache: "no-store" });
        if (!res.ok) throw new LinkError(problemFor(res.status));
        const json = (await res.json()) as Access & { data?: Access };
        const payload = json.data ?? json;
        if (cancelled) return;
        setAccess(payload);

        if (payload.status === "COMPLETED") {
          setPhase("complete");
          return;
        }

        // Resume: a refresh never loses the candidate's place.
        const trRes = await fetch(`/api/backend/interviews/access/${token}/transcript`, { cache: "no-store" });
        if (trRes.ok) {
          const tr = (await trRes.json()) as {
            data?: { messages: { role: string; content: string }[]; progress?: TurnResult["progress"] };
            messages?: { role: string; content: string }[];
            progress?: TurnResult["progress"];
          };
          const payloadTr = tr.data ?? tr;
          const messages = payloadTr.messages ?? [];
          if (!cancelled && messages.length > 0) {
            setBubbles(
              messages.map((m, i) => ({
                id: i + 1,
                role: m.role === "CANDIDATE" || m.role === "USER" ? ("me" as const) : ("ai" as const),
                text: m.content,
              })),
            );
            nextId.current = messages.length + 1;
            if (payloadTr.progress) setProgress(payloadTr.progress);
            setPhase("chat");
            return;
          }
        }
        if (!cancelled) setPhase("intro");
      } catch (e) {
        if (cancelled) return;
        setProblem(e instanceof LinkError ? e.kind : "connection");
        setPhase("problem");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  // Keep the newest message in view.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [bubbles, busy]);

  const push = useCallback((role: Bubble["role"], text: string) => {
    const id = nextId.current++;
    setBubbles((prev) => [...prev, { id, role, text }]);
    return id;
  }, []);

  /**
   * Apply a finished turn. When a stage ends, the reply already opens the next
   * stage, so the "stage complete" divider goes just before that reply.
   */
  const finishTurn = useCallback((turn: TurnResult, replyId?: number) => {
    setProgress(turn.progress);
    if (turn.interviewCompleted) {
      setPhase("complete");
      return;
    }
    if (!turn.stageCompleted) return;
    const divider: Bubble = {
      id: nextId.current++,
      role: "divider",
      text: `Stage ${turn.progress.completedStages} of ${turn.progress.totalStages} complete`,
    };
    setBubbles((prev) => {
      const index = replyId === undefined ? -1 : prev.findIndex((b) => b.id === replyId);
      return index < 0 ? [...prev, divider] : [...prev.slice(0, index), divider, ...prev.slice(index)];
    });
  }, []);

  const begin = useCallback(async () => {
    if (!access) return;
    setBusy(true);
    setError(null);
    try {
      if (access.status === "NOT_STARTED") {
        // Token-scoped: the invite link is the credential, not a session.
        await postJson(`/api/backend/interviews/access/${token}/start`);
      }
      const opened = await postJson<{ result: TurnResult }>(`/api/interview/${access.interviewId}/start`);
      setPhase("chat");
      const replyId = push("ai", opened.result.reply);
      finishTurn(opened.result, replyId);
    } catch {
      setError("We couldn't start your interview. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [access, finishTurn, push, token]);

  /** Send the answer; the reply streams in over SSE and grows in place. */
  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || !access || busy) return;
    const myId = push("me", content);
    setDraft("");
    setBusy(true);
    setError(null);

    let aiId: number | null = null;
    const appendDelta = (text: string) => {
      if (aiId === null) {
        const id = push("ai", text);
        aiId = id;
        setStreamingId(id);
        return;
      }
      const id = aiId;
      setBubbles((prev) => prev.map((b) => (b.id === id ? { ...b, text: b.text + text } : b)));
    };

    try {
      const res = await fetch(`/api/interview/${access.interviewId}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok || !res.body) throw new Error(`${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as
            | { type: "start" }
            | { type: "delta"; text: string }
            | { type: "done"; result: TurnResult }
            | { type: "error"; message: string };
          if (event.type === "delta") appendDelta(event.text);
          else if (event.type === "done") {
            const replyId = aiId ?? push("ai", event.result.reply);
            finishTurn(event.result, replyId);
          } else if (event.type === "error") throw new Error(event.message);
        }
      }
    } catch {
      if (aiId === null) {
        // Nothing came back, so the answer wasn't accepted: put it back in the box.
        setBubbles((prev) => prev.filter((b) => b.id !== myId));
        setDraft(content);
        setError("Your answer wasn't sent. Check your connection and send it again; nothing was lost.");
      } else {
        setError("The connection dropped while the interviewer was replying. Refresh to continue where you left off.");
      }
    } finally {
      setBusy(false);
      setStreamingId(null);
    }
  }, [access, busy, draft, finishTurn, push]);

  if (phase === "loading") {
    return (
      <CenteredPage>
        <span className="flex items-center justify-center gap-2 text-muted-fg">
          <Spinner /> Opening your interview…
        </span>
      </CenteredPage>
    );
  }

  if (phase === "problem") {
    return (
      <ProblemScreen
        kind={problem}
        onRetry={() => {
          setPhase("loading");
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const total = progress?.totalQuestions ?? 0;
  const answered = progress?.answeredQuestions ?? 0;
  const firstName = access?.candidate.name.split(" ")[0] ?? "";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-on-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{access?.job.title ?? "Interview"}</p>
            {phase === "chat" && total > 0 && (
              <p className="tabular text-xs text-muted-fg">
                Stage {Math.min((progress?.completedStages ?? 0) + 1, progress?.totalStages ?? 1)} of {progress?.totalStages} ·{" "}
                {answered} of {total} answered
              </p>
            )}
          </div>
          {phase === "chat" && (
            <span className="hidden items-center gap-1.5 text-xs text-muted-fg sm:flex">
              <Save className="size-3.5" aria-hidden /> Progress saved
            </span>
          )}
          <ThemeToggle />
        </div>
        {phase === "chat" && total > 0 && (
          <Progress value={answered} max={total} label="Interview progress" className="h-1 rounded-none" />
        )}
      </header>

      {phase === "intro" && access && (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hi {firstName}, welcome to your interview</h1>
          <p className="mt-2 text-base text-muted-fg">
            For the <strong className="font-semibold text-fg">{access.job.title}</strong> role. Here&apos;s what to expect.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoTile icon={<MessageSquareText />} title="A conversation">
              An AI interviewer asks the questions one at a time. Answer in your own words.
            </InfoTile>
            <InfoTile icon={<Clock />} title="No time limit">
              Take as long as you need on each answer.
            </InfoTile>
            <InfoTile icon={<Save />} title="Progress is saved">
              You can refresh or come back to this link later and continue.
            </InfoTile>
            <InfoTile icon={<UserCheck />} title="People decide">
              The AI scores answers against the company&apos;s criteria; the hiring team makes the decision.
            </InfoTile>
          </ul>
          <StartForm busy={busy} error={error} onStart={begin} />
        </main>
      )}

      {phase !== "intro" && (
        <>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
            <div role="log" aria-live="polite" aria-label="Interview conversation" className="space-y-4">
              {bubbles.map((bubble) =>
                bubble.role === "divider" ? (
                  <div key={bubble.id} className="flex items-center gap-3 py-2 text-xs font-medium text-success">
                    <span className="h-px flex-1 bg-border" />
                    <CheckCircle2 className="size-3.5" aria-hidden /> {bubble.text}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                ) : (
                  <ChatBubble
                    key={bubble.id}
                    role={bubble.role === "ai" ? "ai" : "candidate"}
                    author={bubble.role === "ai" ? "Interviewer" : "You"}
                    streaming={bubble.id === streamingId}
                  >
                    {bubble.text}
                  </ChatBubble>
                ),
              )}
              {busy && streamingId === null && phase === "chat" && <TypingIndicator />}
            </div>
            {phase === "complete" && <CompleteCard name={firstName} />}
            <div ref={endRef} />
          </main>

          {phase === "chat" && (
            <div className="sticky bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur-sm">
              <div className="mx-auto max-w-3xl space-y-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                {error && <Alert variant="danger" title={error} />}
                <Composer
                  aria-label="Your answer"
                  placeholder="Type your answer…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onSend={send}
                  sending={busy}
                  canSend={draft.trim().length > 0}
                />
                <p className="hidden text-center text-xs text-subtle-fg sm:block">Enter to send · Shift + Enter for a new line</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StartForm({ busy, error, onStart }: { busy: boolean; error: string | null; onStart: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <Field label="I understand this interview is conducted by an AI and my answers will be reviewed by the hiring team." inline>
        <Checkbox checked={agreed} onCheckedChange={(value) => setAgreed(value === true)} />
      </Field>
      {error && <Alert variant="danger" title={error} />}
      <Button size="lg" className="w-full" disabled={!agreed} loading={busy} onClick={onStart}>
        Start interview
      </Button>
    </div>
  );
}

function InfoTile({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary [&_svg]:size-[18px]" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-fg">{children}</p>
      </div>
    </li>
  );
}

function CompleteCard({ name }: { name: string }) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-6 text-center shadow-sm sm:p-8">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-subtle text-success">
        <CheckCircle2 className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Interview complete</h1>
      <p className="mx-auto mt-2 max-w-md text-base text-muted-fg">
        Thank you{name ? `, ${name}` : ""}. Your answers are saved and on their way to the hiring team.
      </p>
      <div className="mx-auto mt-6 max-w-md space-y-3 text-left">
        <p className="flex gap-3 text-sm text-fg">
          <UserCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          A person on the hiring team reviews your interview and makes the decision.
        </p>
        <p className="flex gap-3 text-sm text-fg">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          You&apos;ll hear back by email. Nothing else is needed from you; you can close this window.
        </p>
      </div>
    </section>
  );
}

const PROBLEMS: Record<LinkProblem, { icon: ReactNode; title: string; text: string }> = {
  invalid: {
    icon: <Link2Off />,
    title: "This interview link isn't valid",
    text: "Check that you opened the full link from your invitation email. If it still doesn't work, reply to that email and the hiring team will send a new one.",
  },
  expired: {
    icon: <TimerOff />,
    title: "This interview link has expired",
    text: "Links stop working after a while for security. Reply to your invitation email and the hiring team will send you a fresh link.",
  },
  connection: {
    icon: <WifiOff />,
    title: "We can't reach the interview right now",
    text: "This is usually a connection problem. Check your internet connection and try again. Your progress is saved.",
  },
};

function ProblemScreen({ kind, onRetry }: { kind: LinkProblem; onRetry: () => void }) {
  const problem = PROBLEMS[kind];
  return (
    <CenteredPage>
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-surface-2 text-muted-fg [&_svg]:size-6" aria-hidden>
        {problem.icon}
      </span>
      <h1 className="mt-4 text-xl font-semibold">{problem.title}</h1>
      <p className="mt-2 text-sm text-muted-fg">{problem.text}</p>
      {kind === "connection" && (
        <Button className="mt-6" variant="secondary" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </CenteredPage>
  );
}

function CenteredPage({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">{children}</div>
    </main>
  );
}
