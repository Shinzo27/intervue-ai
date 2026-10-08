"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Job {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  pipeline: { id: string; name: string } | null;
  pipelineVersion: { id: string; version: number } | null;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Job[]>("/job-postings")
      .then(setJobs)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold">Job postings</h1>
      <p className="muted mt-1 text-sm">
        A published job is pinned to an immutable pipeline snapshot — editing the
        pipeline later never changes this job.
      </p>

      {error && (
        <div className="panel mt-5 border-[var(--fail)] p-4 text-sm text-[var(--fail)]">
          {error}
        </div>
      )}

      <section className="panel mt-5 overflow-hidden">
        {loading ? (
          <p className="muted p-4 text-sm">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="muted p-4 text-sm">No job postings yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Pipeline</th>
                <th>Snapshot</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <a
                      href={`/jobs/${j.id}`}
                      className="font-medium hover:text-[var(--accent)] hover:underline"
                    >
                      {j.title}
                    </a>
                  </td>
                  <td>
                    <span
                      className={
                        j.status === "PUBLISHED"
                          ? "chip chip-pass"
                          : j.status === "CLOSED"
                            ? "chip chip-fail"
                            : "chip"
                      }
                    >
                      {j.status}
                    </span>
                  </td>
                  <td>{j.pipeline?.name ?? "—"}</td>
                  <td className="muted text-xs">
                    {j.pipelineVersion ? `v${j.pipelineVersion.version} (frozen)` : "—"}
                  </td>
                  <td className="muted text-xs">
                    {new Date(j.createdAt).toLocaleDateString()}
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
