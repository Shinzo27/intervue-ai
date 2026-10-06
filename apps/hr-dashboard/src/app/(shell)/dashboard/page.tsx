"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Application {
  id: string;
  status: string;
  createdAt: string;
  candidate: { firstName: string; lastName: string; email: string };
  jobPosting: { title: string };
}

interface Job {
  id: string;
  title: string;
  status: string;
}

export default function DashboardPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, j] = await Promise.all([
          apiFetch<Application[]>("/applications"),
          apiFetch<Job[]>("/job-postings"),
        ]);
        setApps(a);
        setJobs(j);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byStatus = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="muted mt-1 text-sm">
        Hiring pipeline at a glance — interviews are conducted and scored by the AI service.
      </p>

      {error && (
        <div className="panel mt-5 border-[var(--fail)] p-4 text-sm text-[var(--fail)]">
          {error}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Job postings" value={loading ? "…" : jobs.length} />
        <Stat label="Applications" value={loading ? "…" : apps.length} />
        <Stat label="In progress" value={loading ? "…" : (byStatus["IN_PROGRESS"] ?? 0)} />
        <Stat label="Completed" value={loading ? "…" : (byStatus["COMPLETED"] ?? 0)} />
      </div>

      <section className="panel mt-6 overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-medium">
          Recent applications
        </div>
        {loading ? (
          <p className="muted p-4 text-sm">Loading…</p>
        ) : apps.length === 0 ? (
          <p className="muted p-4 text-sm">
            No applications yet — publish a job and invite a candidate.
          </p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {apps.slice(0, 8).map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.candidate?.firstName} {a.candidate?.lastName}
                    <div className="muted text-xs">{a.candidate?.email}</div>
                  </td>
                  <td>{a.jobPosting?.title}</td>
                  <td>
                    <StatusChip status={a.status} />
                  </td>
                  <td className="muted text-xs">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-4">
      <div className="muted text-xs uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const cls =
    status === "COMPLETED" || status === "DECIDED"
      ? "chip chip-pass"
      : status === "IN_PROGRESS" || status === "STARTED"
        ? "chip chip-warn"
        : "chip";
  return <span className={cls}>{status}</span>;
}
