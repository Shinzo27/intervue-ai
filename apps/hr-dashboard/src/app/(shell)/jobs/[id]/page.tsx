"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Lock, MoreHorizontal, Rocket, Trash2, UserPlus, Users, Workflow } from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Badge } from "@repo/ui/badge";
import { Button, IconButton } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { ConfirmDialog } from "@repo/ui/confirm-dialog";
import { DataTable, type Column } from "@repo/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { EmptyState } from "@repo/ui/empty-state";
import { Field } from "@repo/ui/field";
import { Input, Textarea } from "@repo/ui/input";
import { PageHeader } from "@repo/ui/page-header";
import { Select } from "@repo/ui/select";
import { Skeleton } from "@repo/ui/skeleton";
import { StatCard } from "@repo/ui/stat-card";
import { StatusPill } from "@repo/ui/status-pill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { toast } from "@repo/ui/toast";
import { CopyIconButton } from "@/components/copy-button";
import { InviteCandidateSheet } from "@/components/jobs/invite-candidate-sheet";
import { apiFetch } from "@/lib/api";
import { errorMessage, formatDate, formatDateTime, fullName } from "@/lib/format";
import type { Application, Job, PipelineSummary } from "@/lib/types";
import { interviewLink } from "@/lib/urls";
import { useResource } from "@/lib/use-resource";

export default function JobDetailPage() {
  const id = useParams<{ id: string }>()?.id ?? null;
  const router = useRouter();
  const [tab, setTab] = useState("overview");

  const { data, error, loading, refresh } = useResource(id, async () => {
    const [job, applications, pipelines] = await Promise.all([
      apiFetch<Job>(`/job-postings/${id}`),
      apiFetch<Application[]>("/applications"),
      apiFetch<PipelineSummary[]>("/pipelines"),
    ]);
    return { job, applications: applications.filter((a) => a.jobPostingId === id), pipelines };
  });

  if (loading) return <DetailSkeleton />;
  if (!data) {
    return (
      <EmptyState
        title="Job not found"
        description={error ?? "It may have been deleted, or it belongs to another organization."}
        action={
          <Button asChild variant="secondary">
            <Link href="/jobs">Back to jobs</Link>
          </Button>
        }
      />
    );
  }

  const { job, applications } = data;
  // GET /job-postings/:id returns pipelineId but not the pipeline relation.
  const pipeline = job.pipeline ?? data.pipelines.find((p) => p.id === job.pipelineId) ?? null;
  const isDraft = job.status === "DRAFT";
  const isPublished = job.status === "PUBLISHED";
  const count = (...statuses: string[]) => applications.filter((a) => statuses.includes(a.status)).length;

  async function publish() {
    try {
      await apiFetch(`/job-postings/${job.id}/publish`, { method: "POST" });
      toast.success("Job published", "The pipeline version is now frozen for this job.");
      await refresh();
    } catch (e) {
      toast.error("Couldn't publish", errorMessage(e));
    }
  }

  async function removeDraft() {
    try {
      await apiFetch(`/job-postings/${job.id}`, { method: "DELETE" });
      toast.success("Draft deleted");
      router.push("/jobs");
    } catch (e) {
      toast.error("Couldn't delete", errorMessage(e));
    }
  }

  const inviteButton = (
    <Button disabled={!isPublished}>
      <UserPlus /> Invite candidate
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <StatusPill status={job.status} />
            {job.pipelineVersion && (
              <Badge variant="outline">
                <Lock /> Pipeline v{job.pipelineVersion.version} frozen
              </Badge>
            )}
          </>
        }
        title={job.title}
        description={job.description || "No description yet."}
        actions={
          <>
            {isDraft && (
              <ConfirmDialog
                trigger={
                  <Button disabled={!pipeline}>
                    <Rocket /> Publish job
                  </Button>
                }
                title="Publish this job?"
                description={`Publishing freezes the current version of “${pipeline?.name ?? "the pipeline"}” for this job. Later pipeline edits won't change its interviews, and the job can no longer be edited.`}
                confirmLabel="Publish"
                onConfirm={publish}
              />
            )}
            {isPublished && (
              <InviteCandidateSheet jobId={job.id} jobTitle={job.title} trigger={inviteButton} onInvited={refresh} />
            )}
            {isDraft && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton aria-label="More actions" variant="secondary">
                    <MoreHorizontal />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <ConfirmDialog
                    trigger={
                      <DropdownMenuItem destructive onSelect={(e) => e.preventDefault()}>
                        <Trash2 /> Delete draft
                      </DropdownMenuItem>
                    }
                    title="Delete this draft job?"
                    description="This can't be undone. Published jobs can't be deleted."
                    confirmLabel="Delete"
                    destructive
                    onConfirm={removeDraft}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {isDraft && !pipeline && (
        <Alert
          variant="warning"
          title="Attach an interview pipeline before publishing"
          className="mb-6"
          action={
            <Button size="sm" variant="secondary" onClick={() => setTab("settings")}>
              Choose pipeline
            </Button>
          }
        >
          The pipeline defines the questions the AI asks and the rubric it scores against.
        </Alert>
      )}
      {isDraft && pipeline && (
        <Alert title="Draft — publish to start inviting candidates" className="mb-6">
          Publishing freezes the pipeline into an immutable snapshot for this job.
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="candidates">
            Candidates
            <span className="tabular rounded-sm bg-surface-2 px-1.5 text-xs text-muted-fg">{applications.length}</span>
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Invited" value={count("INVITED")} />
            <StatCard label="In progress" value={count("STARTED", "IN_PROGRESS")} tone="ai" />
            <StatCard label="Awaiting decision" value={count("COMPLETED")} tone="warning" />
            <StatCard label="Decided" value={count("DECIDED")} tone="success" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="size-4 text-muted-fg" aria-hidden /> Interview pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pipeline ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-fg">{pipeline.name}</p>
                    <p className="text-sm text-muted-fg">
                      {job.pipelineVersion
                        ? `Version ${job.pipelineVersion.version} is frozen for this job${job.pipelineVersion.publishedAt ? ` since ${formatDate(job.pipelineVersion.publishedAt)}` : ""}.`
                        : "The latest published version is frozen when you publish this job."}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/pipelines/${pipeline.id}`}>
                      Open pipeline <ArrowRight />
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-fg">No pipeline attached yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="candidates">
          <CandidatesTable
            applications={applications}
            empty={
              <EmptyState
                icon={Users}
                title="No candidates yet"
                description={
                  isPublished
                    ? "Invite a candidate to send them their interview link."
                    : "Publish this job, then invite candidates."
                }
                action={
                  isPublished ? (
                    <InviteCandidateSheet jobId={job.id} jobTitle={job.title} trigger={inviteButton} onInvited={refresh} />
                  ) : undefined
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="settings">
          <JobSettings job={job} pipelines={data.pipelines} onSaved={refresh} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function CandidatesTable({ applications, empty }: { applications: Application[]; empty: ReactNode }) {
  const columns: Column<Application>[] = [
    {
      key: "name",
      header: "Candidate",
      sortValue: (a) => fullName(a.candidate).toLowerCase(),
      cell: (a) => (
        <div className="min-w-0">
          <Link data-row-link href={`/applications/${a.id}`} className="font-medium text-fg hover:text-primary">
            {fullName(a.candidate)}
          </Link>
          <p className="truncate text-[13px] text-muted-fg">{a.candidate.email}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", sortValue: (a) => a.status, cell: (a) => <StatusPill status={a.status} /> },
    {
      key: "invited",
      header: "Invited",
      hideBelow: "md",
      sortValue: (a) => a.createdAt,
      cell: (a) => <span className="text-muted-fg">{formatDateTime(a.createdAt)}</span>,
    },
    {
      key: "link",
      header: <span className="sr-only">Interview link</span>,
      align: "right",
      cell: (a) => (
        <CopyIconButton text={interviewLink(a.inviteToken)} label={`Copy interview link for ${fullName(a.candidate)}`} />
      ),
    },
  ];
  return (
    <DataTable
      label="Candidates for this job"
      columns={columns}
      rows={applications}
      getRowId={(a) => a.id}
      rowLinks
      initialSort={{ key: "invited", dir: "desc" }}
      empty={empty}
    />
  );
}

function JobSettings({ job, pipelines, onSaved }: { job: Job; pipelines: PipelineSummary[]; onSaved: () => Promise<void> }) {
  const editable = job.status === "DRAFT";
  const [pipelineId, setPipelineId] = useState(job.pipeline?.id ?? job.pipelineId ?? "");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await apiFetch(`/job-postings/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: String(form.get("title")).trim(),
          description: String(form.get("description") ?? "").trim(),
          ...(pipelineId ? { pipelineId } : {}),
        }),
      });
      toast.success("Job updated");
      await onSaved();
    } catch (e) {
      toast.error("Couldn't save", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="p-6">
        {!editable && (
          <Alert title="Published jobs are read-only" className="mb-5">
            Their configuration is frozen so every candidate gets the same interview.
          </Alert>
        )}
        <form onSubmit={save} className="space-y-4">
          <Field label="Job title" required>
            <Input name="title" defaultValue={job.title} required disabled={!editable} />
          </Field>
          <Field label="Description">
            <Textarea name="description" defaultValue={job.description ?? ""} rows={4} disabled={!editable} />
          </Field>
          <Field label="Interview pipeline">
            <Select
              value={pipelineId}
              onValueChange={setPipelineId}
              placeholder="Choose a pipeline"
              disabled={!editable}
              options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
          {editable && (
            <div className="flex justify-end">
              <Button type="submit" loading={busy}>
                Save changes
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-10 w-80" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}
