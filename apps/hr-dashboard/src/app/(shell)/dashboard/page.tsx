"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  Inbox,
  Plus,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Avatar } from "@repo/ui/avatar";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { Skeleton } from "@repo/ui/skeleton";
import { StatCard } from "@repo/ui/stat-card";
import { StatusPill } from "@repo/ui/status-pill";
import { apiFetch, ApiError } from "@/lib/api";
import { humanizeAction, type AuditEvent } from "@/lib/audit";
import { useSession } from "@/lib/auth-client";
import { formatRelative, fullName } from "@/lib/format";
import type { Application, Job, PipelineSummary } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

/** Lower = more urgent. Completed interviews wait on a human decision. */
const URGENCY: Record<string, number> = { COMPLETED: 0, IN_PROGRESS: 1, STARTED: 2, INVITED: 3 };

interface Overview {
  applications: Application[];
  jobs: Job[];
  pipelines: PipelineSummary[];
  aiEvents: AuditEvent[] | null;
}

async function loadOverview(): Promise<Overview> {
  const [applications, jobs, pipelines, aiEvents] = await Promise.all([
    apiFetch<Application[]>("/applications"),
    apiFetch<Job[]>("/job-postings"),
    apiFetch<PipelineSummary[]>("/pipelines"),
    // Interviewers can't read the audit trail; the feed is simply hidden for them.
    apiFetch<AuditEvent[]>("/audit?limit=8&actorType=AI").catch((error) => {
      if (error instanceof ApiError && error.status === 403) return null;
      throw error;
    }),
  ]);
  return { applications, jobs, pipelines, aiEvents };
}

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data, error, loading } = useResource("dashboard", loadOverview);
  const [now] = useState(() => Date.now());

  const applications = data?.applications ?? [];
  const jobs = data?.jobs ?? [];
  const count = (status: string) => applications.filter((a) => a.status === status).length;
  const inProgress = count("STARTED") + count("IN_PROGRESS");
  const awaiting = count("COMPLETED");

  const attention = applications
    .filter((a) => a.status in URGENCY)
    .sort((a, b) => URGENCY[a.status]! - URGENCY[b.status]! || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const firstName = session?.user?.name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`${greeting(new Date(now).getHours())}${firstName ? `, ${firstName}` : ""}`}
        description="Here's where your hiring stands. Interviews are run and scored by the AI; decisions stay with you."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/pipelines?new=1">
                <Workflow /> New pipeline
              </Link>
            </Button>
            <Button asChild>
              <Link href="/jobs?new=1">
                <Plus /> New job
              </Link>
            </Button>
          </>
        }
      />

      {error && <Alert variant="danger" title="Couldn't load your dashboard" className="mb-6">{error}</Alert>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Open jobs"
          value={jobs.filter((j) => j.status === "PUBLISHED").length}
          hint={`${jobs.filter((j) => j.status === "DRAFT").length} in draft`}
          icon={BriefcaseBusiness}
          tone="primary"
          loading={loading}
        />
        <StatCard label="Interviews in progress" value={inProgress} icon={Clock} tone="ai" loading={loading} />
        <StatCard
          label="Awaiting decision"
          value={awaiting}
          hint={awaiting ? "Review and decide" : "All caught up"}
          icon={ClipboardCheck}
          tone="warning"
          loading={loading}
        />
        <StatCard label="Decided" value={count("DECIDED")} icon={CheckCircle2} tone="success" loading={loading} />
      </div>

      {data && <GettingStarted data={data} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle>Needs your attention</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/applications">
                All applications <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <ListSkeleton />
            ) : attention.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Nothing waiting on you"
                description="Publish a job and invite candidates. Finished interviews show up here for a decision."
                className="border-0 py-8"
              />
            ) : (
              <ul className="-mx-2 divide-y divide-border">
                {attention.map((application) => {
                  const name = fullName(application.candidate);
                  return (
                    <li key={application.id} className="relative flex items-center gap-3 rounded-md px-2 py-3 hover:bg-surface-hover">
                      <Avatar name={name} />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/applications/${application.id}`}
                          className="block truncate text-sm font-medium text-fg after:absolute after:inset-0"
                        >
                          {name}
                        </Link>
                        <p className="truncate text-[13px] text-muted-fg">
                          {application.jobPosting?.title ?? "Job"} · {formatRelative(application.createdAt, now)}
                        </p>
                      </div>
                      <StatusPill status={application.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {data?.aiEvents !== null && (
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-ai" aria-hidden /> AI activity
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/audit">Audit</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <ListSkeleton />
              ) : !data?.aiEvents?.length ? (
                <p className="py-6 text-center text-sm text-muted-fg">
                  The AI hasn&apos;t done anything yet. Its actions appear here as interviews run.
                </p>
              ) : (
                <ol className="space-y-4">
                  {data.aiEvents.map((event) => (
                    <li key={event.id} className="flex gap-3">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ai-subtle text-ai">
                        <Sparkles className="size-3" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-fg">{humanizeAction(event.action)}</p>
                        <p className="text-xs text-muted-fg">
                          {event.entityType.toLowerCase()} · {formatRelative(event.createdAt, now)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function GettingStarted({ data }: { data: Overview }) {
  const steps = [
    { done: data.pipelines.length > 0, label: "Create an interview pipeline", href: "/pipelines?new=1" },
    {
      done: data.pipelines.some((p) => p.versions?.some((v) => v.publishedAt)) || data.jobs.some((j) => j.pipelineVersion),
      label: "Publish a pipeline version",
      href: "/pipelines",
    },
    { done: data.jobs.some((j) => j.status === "PUBLISHED"), label: "Create and publish a job", href: "/jobs?new=1" },
    { done: data.applications.length > 0, label: "Invite your first candidate", href: "/jobs" },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return null;

  return (
    <Card className="mt-6 border-primary/30">
      <CardHeader>
        <CardTitle>Get your first interview running</CardTitle>
        <p className="text-sm text-muted-fg">
          {steps.length - remaining} of {steps.length} done
        </p>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.label}>
              <Link
                href={step.href}
                className="flex h-full items-center gap-3 rounded-md border border-border p-3 text-sm transition-colors hover:border-border-strong hover:bg-surface-hover"
              >
                {step.done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" />
                ) : (
                  <Circle className="size-5 shrink-0 text-subtle-fg" aria-label="To do" />
                )}
                <span className={step.done ? "text-muted-fg line-through" : "font-medium text-fg"}>
                  {index + 1}. {step.label}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4 py-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
