"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Application {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  candidate: { firstName: string; lastName: string; email: string };
  jobPosting: { title: string };
}

const FILTERS = ["ALL", "INVITED", "IN_PROGRESS", "COMPLETED", "DECIDED"] as const;

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Application[]>("/applications")
      .then(setApps)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const shown = filter === "ALL" ? apps : apps.filter((a) => a.status === filter);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold">Applications</h1>
      <p className="muted mt-1 text-sm">
        Candidate applications across every job posting in this organization.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "chip chip-pass"
                : "chip hover:border-[var(--accent)]"
            }
          >
            {f.toLowerCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="panel mt-5 border-[var(--fail)] p-4 text-sm text-[var(--fail)]">
          {error}
        </div>
      )}

      <section className="panel mt-4 overflow-hidden">
        {loading ? (
          <p className="muted p-4 text-sm">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="muted p-4 text-sm">No applications match this filter.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job</th>
                <th>Status</th>
                <th>Completed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.candidate?.firstName} {a.candidate?.lastName}
                    <div className="muted text-xs">{a.candidate?.email}</div>
                  </td>
                  <td>{a.jobPosting?.title}</td>
                  <td>
                    <span className={a.status === "DECIDED" ? "chip chip-pass" : "chip"}>
                      {a.status}
                    </span>
                  </td>
                  <td className="muted text-xs">
                    {a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="text-right">
                    <a
                      href={`/applications/${a.id}`}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      Review →
                    </a>
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
