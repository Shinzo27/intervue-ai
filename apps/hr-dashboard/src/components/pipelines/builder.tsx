"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ListPlus,
  MoreHorizontal,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Badge } from "@repo/ui/badge";
import { Button, IconButton } from "@repo/ui/button";
import { Card, CardContent } from "@repo/ui/card";
import { ConfirmDialog } from "@repo/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { EmptyState } from "@repo/ui/empty-state";
import { Field } from "@repo/ui/field";
import { Input, Textarea } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/cn";
import { Select } from "@repo/ui/select";
import { Skeleton } from "@repo/ui/skeleton";
import { toast } from "@repo/ui/toast";
import { apiFetch } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { QUESTION_TYPES, type Pipeline, type PipelineVersion, type QuestionType, type Stage } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { CandidatePreview } from "./candidate-preview";
import { InlineText } from "./inline-text";
import { QuestionCard } from "./question-card";
import { VersionHistorySheet } from "./version-history-sheet";

type Run = (fn: () => Promise<unknown>, success?: string) => Promise<void>;

interface Issue {
  blocking: boolean;
  text: string;
}

/** Problems a recruiter should see before freezing a version. */
function findIssues(stages: Stage[]): Issue[] {
  const issues: Issue[] = [];
  if (stages.length === 0) issues.push({ blocking: true, text: "Add at least one stage." });
  for (const stage of stages) {
    if (stage.questions.length === 0) issues.push({ blocking: true, text: `“${stage.name}” has no questions.` });
    for (const question of stage.questions) {
      if (question.type === "MCQ" && question.options.length < 2)
        issues.push({ blocking: true, text: `A multiple-choice question in “${stage.name}” needs at least two options.` });
      if (question.rubricCriteria.length === 0)
        issues.push({ blocking: false, text: `A question in “${stage.name}” has no rubric, so the AI can't score it.` });
    }
  }
  return issues;
}

export function PipelineBuilder({ pipelineId }: { pipelineId: string }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, error, loading, refresh } = useResource(pipelineId, async () => {
    const [pipeline, versions] = await Promise.all([
      apiFetch<Pipeline>(`/pipelines/${pipelineId}`),
      apiFetch<PipelineVersion[]>(`/pipelines/${pipelineId}/versions`),
    ]);
    return { pipeline, versions };
  });

  const run: Run = async (fn, success) => {
    try {
      await fn();
      if (success) toast.success(success);
      await refresh();
    } catch (e) {
      toast.error("Couldn't save that change", errorMessage(e));
    }
  };

  if (loading) return <BuilderSkeleton />;
  if (!data) {
    return (
      <EmptyState
        title="Pipeline not found"
        description={error ?? "It may have been deleted."}
        action={
          <Button variant="secondary" asChild>
            <Link href="/pipelines">Back to pipelines</Link>
          </Button>
        }
      />
    );
  }

  const { pipeline, versions } = data;
  const stages = pipeline.stages.slice().sort((a, b) => a.order - b.order);
  const stage = stages.find((s) => s.id === selectedId) ?? stages[0];
  const stageIndex = stage ? stages.indexOf(stage) : -1;
  const questionCount = stages.reduce((n, s) => n + s.questions.length, 0);
  const latest = versions[0];
  const issues = findIssues(stages);
  const blocking = issues.filter((i) => i.blocking);

  async function publish() {
    try {
      const created = await apiFetch<PipelineVersion>(`/pipelines/${pipelineId}/publish`, { method: "POST" });
      toast.success(
        `Version ${created.version} published`,
        `${created.stageCount} stages and ${created.questionCount} questions are frozen.`,
      );
      await refresh();
    } catch (e) {
      toast.error("Couldn't publish", errorMessage(e));
    }
  }

  async function removePipeline() {
    try {
      await apiFetch(`/pipelines/${pipelineId}`, { method: "DELETE" });
      toast.success("Pipeline deleted");
      router.push("/pipelines");
    } catch (e) {
      toast.error("Couldn't delete", errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">Editing draft</Badge>
            {latest ? (
              <Badge variant="success" dot>
                v{latest.version} published
              </Badge>
            ) : (
              <Badge>Never published</Badge>
            )}
          </div>
          <InlineText
            label="Pipeline name"
            value={pipeline.name}
            onSave={(name) =>
              run(() => apiFetch(`/pipelines/${pipelineId}`, { method: "PATCH", body: JSON.stringify({ name }) }), "Renamed")
            }
            className="-ml-2 text-2xl font-semibold tracking-tight"
          />
          <p className="text-sm text-muted-fg">
            {stages.length} {stages.length === 1 ? "stage" : "stages"} · {questionCount}{" "}
            {questionCount === 1 ? "question" : "questions"} in the draft. Published versions never change; jobs keep the
            version they were published with.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <VersionHistorySheet versions={versions} />
          <ConfirmDialog
            trigger={
              <Button disabled={blocking.length > 0}>
                <Rocket /> Publish version
              </Button>
            }
            title={`Publish version ${(latest?.version ?? 0) + 1}?`}
            description={
              <span className="block space-y-3">
                <span className="block">
                  This freezes {stages.length} stages and {questionCount} questions
                  {latest ? ` (v${latest.version} had ${latest.stageCount} and ${latest.questionCount})` : ""}. Jobs published
                  from now on use it; existing jobs keep their version.
                </span>
                {issues.length > 0 && (
                  <span className="block rounded-md bg-warning-subtle p-3 text-fg">
                    {issues.map((issue) => (
                      <span key={issue.text} className="flex gap-2 text-[13px]">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden /> {issue.text}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            }
            confirmLabel="Publish"
            onConfirm={publish}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label="More pipeline actions" variant="secondary">
                <MoreHorizontal />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem destructive onSelect={(e) => e.preventDefault()}>
                    <Trash2 /> Delete pipeline
                  </DropdownMenuItem>
                }
                title="Delete this pipeline?"
                description="The draft is removed. This fails if a job still uses one of its versions."
                confirmLabel="Delete"
                destructive
                onConfirm={removePipeline}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {blocking.length > 0 && stages.length > 0 && (
        <Alert variant="warning" title="Finish the draft before publishing">
          {blocking[0]!.text}
          {blocking.length > 1 ? ` And ${blocking.length - 1} more.` : ""}
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        <StageRail pipelineId={pipelineId} stages={stages} selectedId={stage?.id} onSelect={setSelectedId} run={run} />

        <div className="min-w-0 space-y-4">
          {stage ? (
            <>
              <div className="flex items-center gap-2">
                <span className="tabular shrink-0 text-sm font-medium text-muted-fg">Stage {stageIndex + 1}</span>
                <InlineText
                  label="Stage name"
                  value={stage.name}
                  onSave={(name) =>
                    run(() =>
                      apiFetch(`/pipelines/${pipelineId}/stages/${stage.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ name, order: stage.order }),
                      }),
                    )
                  }
                  className="text-lg font-semibold"
                />
              </div>
              {stage.questions.length === 0 && (
                <EmptyState
                  icon={ListPlus}
                  title="No questions in this stage"
                  description="Add the questions the AI should ask, then a rubric for each so it can score the answers."
                />
              )}
              {stage.questions
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((question, index, list) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    stageId={stage.id}
                    index={index}
                    total={list.length}
                    run={run}
                    api={apiFetch}
                  />
                ))}
              <AddQuestion stage={stage} run={run} />
            </>
          ) : (
            <EmptyState
              icon={ListPlus}
              title="Start with a stage"
              description="Stages group questions, e.g. “Background”, “Technical depth”, “Wrap-up”. The AI moves through them in order."
            />
          )}
        </div>

        <aside className="hidden xl:sticky xl:top-20 xl:block">
          <CandidatePreview stage={stage} stageNumber={stageIndex + 1} stageCount={stages.length} />
        </aside>
      </div>
    </div>
  );
}

function StageRail({
  pipelineId,
  stages,
  selectedId,
  onSelect,
  run,
}: {
  pipelineId: string;
  stages: Stage[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  run: Run;
}) {
  const [name, setName] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await run(
      () =>
        apiFetch(`/pipelines/${pipelineId}/stages`, {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), order: stages.length + 1 }),
        }),
      "Stage added",
    );
    setName("");
  }

  const move = (stage: Stage, delta: number) =>
    run(() =>
      apiFetch(`/pipelines/${pipelineId}/stages/${stage.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: stage.name, order: stage.order + delta }),
      }),
    );

  return (
    <Card className="lg:sticky lg:top-20">
      <CardContent className="space-y-3 p-3">
        <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-fg">Stages</h3>
        <ol className="space-y-1">
          {stages.map((stage, index) => {
            const active = stage.id === selectedId;
            const unscored = stage.questions.some((q) => q.rubricCriteria.length === 0);
            return (
              <li key={stage.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(stage.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-2 pr-16 text-left text-sm transition-colors",
                    active ? "bg-primary-subtle text-primary" : "text-fg hover:bg-surface-hover",
                  )}
                >
                  <span
                    className={cn(
                      "tabular grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      active ? "bg-primary text-on-primary" : "bg-surface-2 text-muted-fg",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{stage.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-fg">
                      {stage.questions.length} {stage.questions.length === 1 ? "question" : "questions"}
                      {unscored ? (
                        <AlertTriangle className="size-3 text-warning" aria-label="Has unscored questions" />
                      ) : stage.questions.length > 0 ? (
                        <CheckCircle2 className="size-3 text-success" aria-label="Ready" />
                      ) : null}
                    </span>
                  </span>
                </button>
                <div className="absolute right-1 top-1/2 flex -translate-y-1/2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton
                    aria-label={`Move ${stage.name} up`}
                    size="sm"
                    className="size-7"
                    disabled={index === 0}
                    onClick={() => move(stage, -1)}
                  >
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    aria-label={`Move ${stage.name} down`}
                    size="sm"
                    className="size-7"
                    disabled={index === stages.length - 1}
                    onClick={() => move(stage, 1)}
                  >
                    <ArrowDown />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ol>
        {stages.length > 0 && selectedId && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="w-full justify-start text-danger hover:text-danger">
                <Trash2 /> Delete selected stage
              </Button>
            }
            title="Delete this stage?"
            description="Its questions and rubrics are removed from the draft. Published versions are unaffected."
            confirmLabel="Delete stage"
            destructive
            onConfirm={() =>
              run(() => apiFetch(`/pipelines/${pipelineId}/stages/${selectedId}`, { method: "DELETE" }), "Stage deleted")
            }
          />
        )}
        <form onSubmit={add} className="flex gap-2 border-t border-border pt-3">
          <Input
            aria-label="New stage name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New stage"
            className="h-8"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!name.trim()} aria-label="Add stage">
            <Plus />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AddQuestion({ stage, run }: { stage: Stage; run: Run }) {
  const [text, setText] = useState("");
  const [type, setType] = useState<QuestionType>("MULTI_LINE");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    await run(
      () =>
        apiFetch(`/stages/${stage.id}/questions`, {
          method: "POST",
          body: JSON.stringify({ question: text.trim(), type, order: stage.questions.length + 1, required: true }),
        }),
      "Question added",
    );
    setText("");
    setBusy(false);
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Add a question">
            <Textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Walk me through a system you designed. What would you change today?"
            />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="sm:w-52">
              <Select
                aria-label="Question type"
                value={type}
                onValueChange={(value) => setType(value as QuestionType)}
                options={QUESTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
            <Button type="submit" loading={busy} disabled={!text.trim()}>
              <Plus /> Add question
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BuilderSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_300px]">
        <Skeleton className="h-64" />
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="hidden h-96 xl:block" />
      </div>
    </div>
  );
}
