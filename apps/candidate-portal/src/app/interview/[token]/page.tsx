"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

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
  role: "ai" | "me";
  text: string;
}

type Phase = "loading" | "intro" | "chat" | "complete" | "error";

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json?.error?.message ?? json?.message ?? `${res.status}`);
  }
  return json;
}

export default function InterviewPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [phase, setPhase] = useState<Phase>("loading");
  const [access, setAccess] = useState<Access | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [progress, setProgress] = useState<TurnResult["progress"] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);

  /** Load the interview behind the invite token. */
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/backend/interviews/access/${token}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as Access & {
          message?: string;
          data?: Access;
        };
        if (!res.ok) throw new Error(json?.message ?? "This link is not valid.");
        const payload = json.data ?? json;
        setAccess(payload);
        setPhase(payload.status === "COMPLETED" ? "complete" : "intro");
      } catch (e) {
        setError(e instanceof Error ? e.message : "This link is not valid.");
        setPhase("error");
      }
    })();
  }, [token]);

  const push = useCallback((role: Bubble["role"], text: string) => {
    setBubbles((prev) => [...prev, { id: nextId.current++, role, text }]);
  }, []);

  const applyTurn = useCallback(
    (turn: TurnResult) => {
      setProgress(turn.progress);
      push("ai", turn.reply);
      if (turn.interviewCompleted) setPhase("complete");
    },
    [push],
  );

  /** Intro → start the interview (backend transition, then opening turn). */
  const begin = useCallback(async () => {
    if (!access) return;
    setBusy(true);
    setError(null);
    try {
      if (access.status === "NOT_STARTED") {
        // Token-scoped: the invite link is the credential, not a session.
        await postJson(`/api/backend/interviews/access/${token}/start`);
      }
      const opened = await postJson<{ result: TurnResult }>(
        `/api/interview/${access.interviewId}/start`,
      );
      setPhase("chat");
      applyTurn(opened.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the interview");
    } finally {
      setBusy(false);
    }
  }, [access, applyTurn, token]);

  /** Send the candidate's answer and render the interviewer's reply. */
  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || !access || busy) return;
    push("me", content);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const turn = await postJson<{ result: TurnResult }>(
        `/api/interview/${access.interviewId}/chat`,
        { content },
      );
      applyTurn(turn.result);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Your answer could not be saved: ${e.message}`
          : "Your answer could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }, [access, applyTurn, busy, draft, push]);

  if (phase === "loading") {
    return <Centered>Checking your interview link…</Centered>;
  }

  if (phase === "error") {
    return (
      <Centered>
        <p className="font-medium">We could not open this interview</p>
        <p className="muted mt-2 text-sm">{error}</p>
        <p className="muted mt-4 text-xs">
          Interview links expire. Reply to your invitation email and we will send a
          fresh one.
        </p>
      </Centered>
    );
  }

  const total = progress?.totalQuestions ?? 0;
  const answered = progress?.answeredQuestions ?? 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-8">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--accent)]">Intervue AI</span>
          {access && (
            <span className="muted text-xs">
              {access.job.title} · {access.candidate.name}
            </span>
          )}
        </div>

        {phase !== "intro" && total > 0 && (
          <div className="mt-4">
            <div className="muted mb-1 flex justify-between text-[11px]">
              <span>
                {progress?.completedStages ?? 0}/{progress?.totalStages ?? 0} stages
              </span>
              <span>
                {answered}/{total} questions answered
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${total ? (answered / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {phase === "intro" && access && (
        <section className="card p-6">
          <h1 className="text-lg font-semibold">Welcome, {access.candidate.name}</h1>
          <p className="muted mt-2 text-sm leading-relaxed">
            You are interviewing for <strong>{access.job.title}</strong>. The interview is
            conducted by an AI interviewer and takes place right here in this window.
            Answer in your own words — there is no time limit, and you can take as long
            as you need on each question.
          </p>

          <ul className="muted mt-4 space-y-1 text-xs">
            <li>• Answer one question at a time; the next one follows automatically.</li>
            <li>• Your answers are scored against the rubric for each question.</li>
            <li>• You can refresh this page — your progress is saved.</li>
          </ul>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            onClick={begin}
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Starting…" : "Start interview"}
          </button>
        </section>
      )}

      {phase !== "intro" && (
        <>
          <div className="flex-1 space-y-3">
            {bubbles.map((b) => (
              <div key={b.id} className={`bubble ${b.role === "ai" ? "bubble-ai" : "bubble-me"}`}>
                {b.text}
              </div>
            ))}
            {busy && <div className="bubble bubble-ai muted">…thinking</div>}
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {phase === "chat" ? (
            <div className="mt-5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
                }}
                rows={4}
                placeholder="Type your answer… (⌘/Ctrl + Enter to send)"
                className="card w-full resize-none px-4 py-3 text-sm outline-none"
              />
              <button
                onClick={send}
                disabled={busy || !draft.trim()}
                className="mt-3 w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send answer"}
              </button>
            </div>
          ) : (
            <section className="card mt-6 p-6 text-center">
              <p className="text-lg font-semibold">Interview complete</p>
              <p className="muted mt-2 text-sm">
                Thank you, {access?.candidate.name}. Your answers have been recorded and
                sent to the hiring team.
              </p>
              <p className="muted mt-3 text-xs">
                You can close this window — nothing else is required from you.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="card max-w-md p-6 text-center text-sm">{children}</div>
    </main>
  );
}
