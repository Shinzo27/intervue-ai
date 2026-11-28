"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@repo/ui/badge";
import { Button, IconButton } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { ConfirmDialog } from "@repo/ui/confirm-dialog";
import { Input } from "@repo/ui/input";
import { Switch } from "@repo/ui/switch";
import { questionTypeLabel, type Question } from "@/lib/types";
import { InlineText } from "./inline-text";

interface QuestionCardProps {
  question: Question;
  stageId: string;
  index: number;
  total: number;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
  api: (path: string, init?: RequestInit) => Promise<unknown>;
}

export function QuestionCard({ question, stageId, index, total, run, api }: QuestionCardProps) {
  const base = `/stages/${stageId}/questions/${question.id}`;
  const patch = (body: object) => api(base, { method: "PATCH", body: JSON.stringify(body) });
  const isMcq = question.type === "MCQ";
  const totalPoints = question.rubricCriteria.reduce((sum, c) => sum + c.maxScore, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className="tabular mt-1 grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-semibold text-muted-fg">
          Q{index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <InlineText
            multiline
            label={`Question ${index + 1} text`}
            value={question.question}
            onSave={(text) => run(() => patch({ question: text }), "Question saved")}
            className="-ml-2 text-[15px] font-medium"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{questionTypeLabel(question.type)}</Badge>
            <label className="flex items-center gap-2 text-[13px] text-muted-fg">
              <Switch
                checked={question.required}
                onCheckedChange={(required) => run(() => patch({ required }))}
                aria-label="Required question"
              />
              Required
            </label>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            aria-label="Move question up"
            size="sm"
            disabled={index === 0}
            onClick={() => run(() => patch({ question: question.question, order: question.order - 1 }))}
          >
            <ArrowUp />
          </IconButton>
          <IconButton
            aria-label="Move question down"
            size="sm"
            disabled={index === total - 1}
            onClick={() => run(() => patch({ question: question.question, order: question.order + 1 }))}
          >
            <ArrowDown />
          </IconButton>
          <ConfirmDialog
            trigger={
              <IconButton aria-label="Delete question" size="sm">
                <Trash2 />
              </IconButton>
            }
            title="Delete this question?"
            description="It's removed from the draft. Published versions keep their copy."
            confirmLabel="Delete"
            destructive
            onConfirm={() => run(() => api(base, { method: "DELETE" }), "Question deleted")}
          />
        </div>
      </div>

      <div className="grid gap-px border-t border-border bg-border md:grid-cols-2">
        <section className="space-y-3 bg-surface-2/60 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Rubric</h4>
            {totalPoints > 0 && <span className="tabular text-xs text-muted-fg">{totalPoints} pts</span>}
          </div>
          {question.rubricCriteria.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[13px] text-warning">
              <AlertTriangle className="size-3.5" aria-hidden /> No criteria: the AI can&apos;t score this question.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {question.rubricCriteria.map((criterion) => (
                <li key={criterion.id} className="group flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 text-sm shadow-sm">
                  <span className="flex-1 truncate">{criterion.name}</span>
                  <span className="tabular font-mono text-xs text-muted-fg">/{criterion.maxScore}</span>
                  <IconButton
                    aria-label={`Remove criterion ${criterion.name}`}
                    size="sm"
                    className="size-6"
                    onClick={() => run(() => api(`${base}/rubrics/${criterion.id}`, { method: "DELETE" }))}
                  >
                    <X />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <AddRow
            placeholder="e.g. Explains trade-offs"
            label="New criterion"
            withScore
            onAdd={(name, maxScore) =>
              run(() => api(`${base}/rubrics`, { method: "POST", body: JSON.stringify({ name, maxScore }) }))
            }
          />
        </section>

        <section className="space-y-3 bg-surface-2/60 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-fg">
            {isMcq ? "Answer options" : "Answer"}
          </h4>
          {isMcq ? (
            <>
              {question.options.length < 2 && (
                <p className="flex items-center gap-1.5 text-[13px] text-warning">
                  <AlertTriangle className="size-3.5" aria-hidden /> Add at least two options.
                </p>
              )}
              <ul className="space-y-1.5">
                {question.options
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((option) => (
                    <li key={option.id} className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 text-sm shadow-sm">
                      <span className="size-3.5 shrink-0 rounded-full border border-input" aria-hidden />
                      <span className="flex-1 truncate">{option.text}</span>
                      <IconButton
                        aria-label={`Remove option ${option.text}`}
                        size="sm"
                        className="size-6"
                        onClick={() => run(() => api(`${base}/options/${option.id}`, { method: "DELETE" }))}
                      >
                        <X />
                      </IconButton>
                    </li>
                  ))}
              </ul>
              <AddRow
                placeholder="Option text"
                label="New option"
                onAdd={(text) =>
                  run(() =>
                    api(`${base}/options`, {
                      method: "POST",
                      body: JSON.stringify({ text, order: question.options.length + 1 }),
                    }),
                  )
                }
              />
            </>
          ) : (
            <p className="text-[13px] text-muted-fg">
              The candidate answers in their own words ({question.type === "SINGLE_LINE" ? "a short line" : "a paragraph or more"}).
              The AI scores the answer against the rubric with two models.
            </p>
          )}
        </section>
      </div>
    </Card>
  );
}

function AddRow({
  placeholder,
  label,
  withScore = false,
  onAdd,
}: {
  placeholder: string;
  label: string;
  withScore?: boolean;
  onAdd: (text: string, score: number) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [score, setScore] = useState(5);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    await onAdd(text.trim(), score);
    setText("");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input aria-label={label} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="h-8" />
      {withScore && (
        <Input
          aria-label="Maximum score"
          type="number"
          min={1}
          max={100}
          value={score}
          onChange={(e) => setScore(Math.max(1, Number(e.target.value) || 1))}
          className="h-8 w-16 font-mono"
        />
      )}
      <Button type="submit" variant="secondary" size="sm" loading={busy} disabled={!text.trim()} aria-label={`Add ${label.toLowerCase()}`}>
        <Plus />
      </Button>
    </form>
  );
}
