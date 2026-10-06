"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Pipeline {
  id: string;
  name: string;
  createdAt: string;
  versions?: { id: string; version: number; publishedAt: string | null }[];
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Pipeline[]>("/pipelines")
      .then(setPipelines)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold">Pipelines</h1>
      <p className="muted mt-1 text-sm">
        Reusable interview templates. Publishing a version freezes it for the jobs
        that use it (draft template ≠ published snapshot).
      </p>

      {error && (
        <div className="panel mt-5 border-[var(--fail)] p-4 text-sm text-[var(--fail)]">
          {error}
        </div>
      )}

      <section className="panel mt-5 overflow-hidden">
        {loading ? (
          <p className="muted p-4 text-sm">Loading…</p>
        ) : pipelines.length === 0 ? (
          <p className="muted p-4 text-sm">No pipelines yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Versions</th>
                <th>Latest published</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {pipelines.map((p) => {
                const versions = p.versions;
                const published = (versions ?? [])
                  .filter((v) => v.publishedAt)
                  .sort((a, b) => b.version - a.version)[0];
                return (
                  <tr key={p.id}>
                    <td className="font-medium">{p.name}</td>
                    <td className="muted text-xs">
                      {versions ? versions.length : "—"}
                    </td>
                    <td>
                      {!versions ? (
                        <span className="chip">not loaded</span>
                      ) : published ? (
                        <span className="chip chip-pass">v{published.version}</span>
                      ) : (
                        <span className="chip">draft only</span>
                      )}
                    </td>
                    <td className="muted text-xs">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <p className="muted mt-4 text-xs">
        The list endpoint returns pipeline rows only — version counts and snapshots load
        on the pipeline detail page (part of the builder slice, next in Phase 8).
      </p>
    </div>
  );
}
