"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Search } from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Avatar } from "@repo/ui/avatar";
import { DataTable, type Column } from "@repo/ui/data-table";
import { EmptyState } from "@repo/ui/empty-state";
import { Input } from "@repo/ui/input";
import { PageHeader } from "@repo/ui/page-header";
import { paginate, Pagination } from "@repo/ui/pagination";
import { Select } from "@repo/ui/select";
import { StatusPill } from "@repo/ui/status-pill";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { CopyIconButton } from "@/components/copy-button";
import { apiFetch } from "@/lib/api";
import { formatDate, fullName } from "@/lib/format";
import type { Application, Job } from "@/lib/types";
import { interviewLink } from "@/lib/urls";
import { useResource } from "@/lib/use-resource";

const PAGE_SIZE = 25;
const ALL_JOBS = "__all";

const FILTERS: { value: string; label: string; statuses: string[] | null }[] = [
  { value: "all", label: "All", statuses: null },
  { value: "awaiting", label: "Awaiting decision", statuses: ["COMPLETED"] },
  { value: "active", label: "In progress", statuses: ["STARTED", "IN_PROGRESS"] },
  { value: "invited", label: "Invited", statuses: ["INVITED"] },
  { value: "decided", label: "Decided", statuses: ["DECIDED"] },
];

async function loadApplications() {
  const [applications, jobs] = await Promise.all([
    apiFetch<Application[]>("/applications"),
    apiFetch<Job[]>("/job-postings"),
  ]);
  return { applications, jobs };
}

export default function ApplicationsPage() {
  const { data, error, loading } = useResource("applications", loadApplications);
  const [filter, setFilter] = useState("all");
  const [jobId, setJobId] = useState(ALL_JOBS);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const applications = data?.applications ?? [];
  const inFilter = (a: Application, value: string) => {
    const statuses = FILTERS.find((f) => f.value === value)?.statuses;
    return !statuses || statuses.includes(a.status);
  };
  const needle = query.trim().toLowerCase();
  const visible = applications.filter(
    (a) =>
      inFilter(a, filter) &&
      (jobId === ALL_JOBS || a.jobPostingId === jobId) &&
      (!needle || `${fullName(a.candidate)} ${a.candidate.email}`.toLowerCase().includes(needle)),
  );

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const columns: Column<Application>[] = [
    {
      key: "candidate",
      header: "Candidate",
      sortValue: (a) => fullName(a.candidate).toLowerCase(),
      cell: (a) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={fullName(a.candidate)} size="sm" />
          <div className="min-w-0">
            <Link data-row-link href={`/applications/${a.id}`} className="block truncate font-medium text-fg hover:text-primary">
              {fullName(a.candidate)}
            </Link>
            <p className="truncate text-[13px] text-muted-fg">{a.candidate.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "job",
      header: "Job",
      hideBelow: "md",
      sortValue: (a) => a.jobPosting?.title ?? "",
      cell: (a) => <span className="text-fg">{a.jobPosting?.title ?? "—"}</span>,
    },
    { key: "status", header: "Status", sortValue: (a) => a.status, cell: (a) => <StatusPill status={a.status} /> },
    {
      key: "invited",
      header: "Invited",
      hideBelow: "lg",
      sortValue: (a) => a.createdAt,
      cell: (a) => <span className="text-muted-fg">{formatDate(a.createdAt)}</span>,
    },
    {
      key: "completed",
      header: "Completed",
      hideBelow: "sm",
      sortValue: (a) => a.completedAt ?? "",
      cell: (a) => <span className="text-muted-fg">{a.completedAt ? formatDate(a.completedAt) : "—"}</span>,
    },
    {
      key: "link",
      header: <span className="sr-only">Interview link</span>,
      align: "right",
      hideBelow: "md",
      cell: (a) => <CopyIconButton text={interviewLink(a.inviteToken)} label={`Copy interview link for ${fullName(a.candidate)}`} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Applications"
        description="Every candidate across your jobs. Finished interviews wait under “Awaiting decision” until someone on your team decides."
      />

      {error && <Alert variant="danger" title="Couldn't load applications" className="mb-4">{error}</Alert>}

      <div className="mb-4 space-y-3">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        >
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
                <span className="tabular rounded-sm bg-surface-2 px-1.5 text-xs text-muted-fg">
                  {applications.filter((a) => inFilter(a, f.value)).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-fg" aria-hidden />
            <Input
              type="search"
              aria-label="Search candidates"
              placeholder="Search name or email"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <div className="sm:w-64">
            <Select
              aria-label="Filter by job"
              value={jobId}
              onValueChange={(value) => {
                setJobId(value);
                setPage(1);
              }}
              options={[
                { value: ALL_JOBS, label: "All jobs" },
                ...(data?.jobs ?? []).map((job) => ({ value: job.id, label: job.title })),
              ]}
            />
          </div>
        </div>
      </div>

      <DataTable
        label="Applications"
        columns={columns}
        rows={paginate(visible, currentPage, PAGE_SIZE)}
        getRowId={(a) => a.id}
        loading={loading}
        rowLinks
        initialSort={{ key: "invited", dir: "desc" }}
        empty={
          applications.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No applications yet"
              description="Publish a job and invite a candidate. Each invitation creates an application here."
            />
          ) : (
            <EmptyState icon={Search} title="No applications match" description="Try another status, job or search term." />
          )
        }
      />
      <Pagination page={currentPage} pageSize={PAGE_SIZE} total={visible.length} onPageChange={setPage} />
    </>
  );
}
