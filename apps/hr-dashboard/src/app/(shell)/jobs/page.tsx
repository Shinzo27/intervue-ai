"use client";

import { useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Lock, Plus, Search } from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { DataTable, type Column } from "@repo/ui/data-table";
import { EmptyState } from "@repo/ui/empty-state";
import { Input } from "@repo/ui/input";
import { PageHeader } from "@repo/ui/page-header";
import { StatusPill } from "@repo/ui/status-pill";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { CreateJobDialog } from "@/components/jobs/create-job-dialog";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Application, Job, PipelineSummary } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PUBLISHED", label: "Published" },
  { value: "CLOSED", label: "Closed" },
];

async function loadJobs() {
  const [jobs, applications, pipelines] = await Promise.all([
    apiFetch<Job[]>("/job-postings"),
    apiFetch<Application[]>("/applications"),
    apiFetch<PipelineSummary[]>("/pipelines"),
  ]);
  return { jobs, applications, pipelines };
}

export default function JobsPage() {
  const { data, error, loading } = useResource("jobs", loadJobs);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  // ?new=1 (from the dashboard and onboarding) opens the create dialog.
  const [creating, setCreating] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("new"),
  );

  const jobs = data?.jobs ?? [];
  const candidates = (jobId: string) => data?.applications.filter((a) => a.jobPostingId === jobId).length ?? 0;
  const visible = jobs.filter(
    (job) =>
      (filter === "ALL" || job.status === filter) &&
      job.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const columns: Column<Job>[] = [
    {
      key: "title",
      header: "Job",
      sortValue: (job) => job.title.toLowerCase(),
      cell: (job) => (
        <div className="min-w-0 max-w-md">
          <Link data-row-link href={`/jobs/${job.id}`} className="font-medium text-fg hover:text-primary">
            {job.title}
          </Link>
          {job.description && <p className="truncate text-[13px] text-muted-fg">{job.description}</p>}
        </div>
      ),
    },
    { key: "status", header: "Status", sortValue: (job) => job.status, cell: (job) => <StatusPill status={job.status} /> },
    {
      key: "pipeline",
      header: "Pipeline",
      hideBelow: "md",
      cell: (job) =>
        job.pipeline ? (
          <span className="flex items-center gap-1.5 text-fg">
            {job.pipeline.name}
            {job.pipelineVersion && (
              <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-fg" title="Frozen snapshot">
                <Lock className="size-3" aria-hidden />v{job.pipelineVersion.version}
              </span>
            )}
          </span>
        ) : (
          <span className="text-subtle-fg">Not attached</span>
        ),
    },
    {
      key: "candidates",
      header: "Candidates",
      align: "right",
      sortValue: (job) => candidates(job.id),
      cell: (job) => <span className="tabular">{candidates(job.id)}</span>,
    },
    {
      key: "created",
      header: "Created",
      hideBelow: "lg",
      sortValue: (job) => job.createdAt,
      cell: (job) => <span className="text-muted-fg">{formatDate(job.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Each published job is pinned to a frozen pipeline version, so later pipeline edits never change a running interview."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New job
          </Button>
        }
      />

      {error && <Alert variant="danger" title="Couldn't load jobs" className="mb-4">{error}</Alert>}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="shadow-none">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
                <span className="tabular rounded-sm bg-surface-2 px-1.5 text-xs text-muted-fg">
                  {f.value === "ALL" ? jobs.length : jobs.filter((j) => j.status === f.value).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-fg" aria-hidden />
          <Input
            type="search"
            aria-label="Search jobs"
            placeholder="Search jobs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <DataTable
        label="Jobs"
        columns={columns}
        rows={visible}
        getRowId={(job) => job.id}
        loading={loading}
        rowLinks
        initialSort={{ key: "created", dir: "desc" }}
        empty={
          jobs.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="No jobs yet"
              description="Create a job, attach an interview pipeline, then publish it to start inviting candidates."
              action={
                <Button onClick={() => setCreating(true)}>
                  <Plus /> New job
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Search} title="No jobs match" description="Try another filter or search term." />
          )
        }
      />

      <CreateJobDialog open={creating} onOpenChange={setCreating} pipelines={data?.pipelines ?? []} />
    </>
  );
}
