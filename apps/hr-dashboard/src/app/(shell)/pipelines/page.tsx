"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, Plus, Workflow } from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { Skeleton } from "@repo/ui/skeleton";
import { CreatePipelineDialog } from "@/components/pipelines/create-pipeline-dialog";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { PipelineSummary, PipelineVersion } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

interface PipelineCardData {
  pipeline: PipelineSummary;
  latest: PipelineVersion | undefined;
  jobs: number;
}

async function loadPipelines(): Promise<PipelineCardData[]> {
  const pipelines = await apiFetch<PipelineSummary[]>("/pipelines");
  // The list returns pipeline rows only; versions carry the counts we show.
  const versions = await Promise.all(
    pipelines.map((p) => apiFetch<PipelineVersion[]>(`/pipelines/${p.id}/versions`).catch(() => [])),
  );
  return pipelines.map((pipeline, index) => {
    const list = versions[index] ?? [];
    return { pipeline, latest: list[0], jobs: list.reduce((n, v) => n + v.jobCount, 0) };
  });
}

export default function PipelinesPage() {
  const { data, error, loading } = useResource("pipelines", loadPipelines);
  // ?new=1 (from the dashboard and onboarding) opens the create dialog.
  const [creating, setCreating] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("new"),
  );

  return (
    <>
      <PageHeader
        title="Pipelines"
        description="Reusable interviews. Edit the draft freely; publishing creates an immutable version that jobs pin to."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New pipeline
          </Button>
        }
      />

      {error && <Alert variant="danger" title="Couldn't load pipelines" className="mb-6">{error}</Alert>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={Workflow}
          title="No pipelines yet"
          description="A pipeline holds the stages, questions and rubric the AI interviewer uses. Build one, publish it, then attach it to a job."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus /> New pipeline
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map(({ pipeline, latest, jobs }) => (
            <li key={pipeline.id}>
              <Card className="group relative flex h-full flex-col p-5 transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary">
                    <Workflow className="size-5" aria-hidden />
                  </span>
                  {latest ? (
                    <Badge variant="success" dot>
                      v{latest.version} published
                    </Badge>
                  ) : (
                    <Badge>Draft only</Badge>
                  )}
                </div>
                <Link
                  href={`/pipelines/${pipeline.id}`}
                  className="mt-4 text-base font-semibold text-fg after:absolute after:inset-0 group-hover:text-primary"
                >
                  {pipeline.name}
                </Link>
                <p className="mb-5 mt-1 text-sm text-muted-fg">
                  {latest
                    ? `${latest.stageCount} stages · ${latest.questionCount} questions in v${latest.version}`
                    : "Not published yet"}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4 text-[13px] text-muted-fg">
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3.5" aria-hidden />
                    {jobs} {jobs === 1 ? "job pinned" : "jobs pinned"}
                  </span>
                  <span className="flex items-center gap-1">
                    Created {formatDate(pipeline.createdAt)}
                    <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CreatePipelineDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
