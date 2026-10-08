"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export interface Option {
  id: string;
  text: string;
  order: number;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string | null;
  maxScore: number;
}

export interface Question {
  id: string;
  question: string;
  type: string;
  order: number;
  required: boolean;
  options: Option[];
  rubricCriteria: RubricCriterion[];
}

export interface Stage {
  id: string;
  name: string;
  order: number;
  questions: Question[];
}

const QUESTION_TYPES = ["TEXT", "MCQ", "MULTI_LINE", "CODE"] as const;

/** One stage card: questions, options and rubric criteria (draft editing). */
export function StageEditor({
  pipelineId,
  stage,
  stageCount,
  onChanged,
}: {
  pipelineId: string;
  stage: Stage;
  stageCount: number;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const move = (delta: number) =>
    run(() =>
      apiFetch(`/pipelines/${pipelineId}/stages/${stage.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: stage.name, order: stage.order + delta }),
      }),
    );

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="chip">stage {stage.order}</span>
          <input
            defaultValue={stage.name}
            onBlur={(e) => {
              if (e.target.value !== stage.name)
                void run(() =>
                  apiFetch(`/pipelines/${pipelineId}/stages/${stage.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ name: e.target.value, order: stage.order }),
                  }),
                );
            }}
            className="panel-2 px-2 py-1 text-sm outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            disabled={busy || stage.order <= 1}
            onClick={() => move(-1)}
            className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40"
          >
            ↑
          </button>
          <button
            disabled={busy || stage.order >= stageCount}
            onClick={() => move(1)}
            className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40"
          >
            ↓
          </button>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await apiFetch(`/pipelines/${pipelineId}/stages/${stage.id}`, {
                  method: "DELETE",
                });
              })
            }
            className="rounded border border-[var(--border)] px-2 py-1 text-[var(--fail)]"
          >
            delete stage
          </button>
        </div>
      </div>

      {error && <p className="px-4 pt-3 text-xs text-[var(--fail)]">{error}</p>}

      <div className="divide-y divide-[var(--border)]">
        {stage.questions.map((question) => (
          <QuestionEditor
            key={question.id}
            stage={stage}
            question={question}
            onChanged={onChanged}
          />
        ))}
      </div>

      <AddQuestion stage={stage} onChanged={onChanged} />
    </div>
  );
}

function AddQuestion({ stage, onChanged }: { stage: Stage; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [type, setType] = useState<(typeof QUESTION_TYPES)[number]>("TEXT");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="New question…"
        className="panel-2 min-w-64 flex-1 px-3 py-2 text-sm outline-none"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as (typeof QUESTION_TYPES)[number])}
        className="panel-2 px-2 py-2 text-xs"
      >
        {QUESTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <button
        disabled={busy || !text.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            await apiFetch(`/stages/${stage.id}/questions`, {
              method: "POST",
              body: JSON.stringify({
                question: text.trim(),
                type,
                order: stage.questions.length + 1,
                required: true,
              }),
            });
            setText("");
            onChanged();
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50"
      >
        Add question
      </button>
    </div>
  );
}

function QuestionEditor({
  stage,
  question,
  onChanged,
}: {
  stage: Stage;
  question: Question;
  onChanged: () => void;
}) {
  const [optionText, setOptionText] = useState("");
  const [criterion, setCriterion] = useState({ name: "", maxScore: 5 });
  const [busy, setBusy] = useState(false);

  const base = `/stages/${stage.id}/questions/${question.id}`;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="chip">Q{question.order}</span>
          <span className="chip">{question.type}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <button
            disabled={busy || question.order <= 1}
            onClick={() =>
              run(() =>
                apiFetch(base, {
                  method: "PATCH",
                  body: JSON.stringify({
                    question: question.question,
                    order: question.order - 1,
                  }),
                }),
              )
            }
            className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40"
          >
            ↑
          </button>
          <button
            disabled={busy || question.order >= stage.questions.length}
            onClick={() =>
              run(() =>
                apiFetch(base, {
                  method: "PATCH",
                  body: JSON.stringify({
                    question: question.question,
                    order: question.order + 1,
                  }),
                }),
              )
            }
            className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40"
          >
            ↓
          </button>
          <button
            disabled={busy}
            onClick={() => run(() => apiFetch(base, { method: "DELETE" }))}
            className="rounded border border-[var(--border)] px-2 py-1 text-[var(--fail)]"
          >
            delete
          </button>
        </div>
      </div>

      <textarea
        defaultValue={question.question}
        onBlur={(e) => {
          if (e.target.value !== question.question)
            void run(() =>
              apiFetch(base, {
                method: "PATCH",
                body: JSON.stringify({ question: e.target.value }),
              }),
            );
        }}
        rows={2}
        className="panel-2 mt-2 w-full px-3 py-2 text-sm outline-none"
      />

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <section>
          <div className="muted mb-1.5 text-[11px] uppercase tracking-wide">
            Rubric criteria (drives AI scoring)
          </div>
          {question.rubricCriteria.length === 0 ? (
            <p className="text-xs text-[var(--warn)]">
              No criteria — this question cannot be scored.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {question.rubricCriteria.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span>
                    {c.name}{" "}
                    <span className="muted">(max {c.maxScore})</span>
                  </span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        apiFetch(`${base}/rubrics/${c.id}`, { method: "DELETE" }),
                      )
                    }
                    className="muted hover:text-[var(--fail)]"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={criterion.name}
              onChange={(e) => setCriterion({ ...criterion, name: e.target.value })}
              placeholder="criterion"
              className="panel-2 flex-1 px-2 py-1 text-xs outline-none"
            />
            <input
              type="number"
              min={1}
              value={criterion.maxScore}
              onChange={(e) =>
                setCriterion({ ...criterion, maxScore: Number(e.target.value) })
              }
              className="panel-2 w-16 px-2 py-1 text-xs outline-none"
            />
            <button
              disabled={busy || !criterion.name.trim()}
              onClick={async () => {
                await run(() =>
                  apiFetch(`${base}/rubrics`, {
                    method: "POST",
                    body: JSON.stringify({
                      name: criterion.name.trim(),
                      maxScore: criterion.maxScore,
                    }),
                  }),
                );
                setCriterion({ name: "", maxScore: 5 });
              }}
              className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-40"
            >
              add
            </button>
          </div>
        </section>

        {question.type === "MCQ" && (
          <section>
            <div className="muted mb-1.5 text-[11px] uppercase tracking-wide">
              Options
            </div>
            <ul className="space-y-1 text-xs">
              {question.options.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span>
                    {o.order}. {o.text}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        apiFetch(`${base}/options/${o.id}`, { method: "DELETE" }),
                      )
                    }
                    className="muted hover:text-[var(--fail)]"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                value={optionText}
                onChange={(e) => setOptionText(e.target.value)}
                placeholder="option text"
                className="panel-2 flex-1 px-2 py-1 text-xs outline-none"
              />
              <button
                disabled={busy || !optionText.trim()}
                onClick={async () => {
                  await run(() =>
                    apiFetch(`${base}/options`, {
                      method: "POST",
                      body: JSON.stringify({
                        text: optionText.trim(),
                        order: question.options.length + 1,
                      }),
                    }),
                  );
                  setOptionText("");
                }}
                className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-40"
              >
                add
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
