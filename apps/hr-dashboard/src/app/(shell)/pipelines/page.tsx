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
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

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

      <div className="panel mt-4 flex items-center gap-2 p-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New pipeline name…"
          className="panel-2 flex-1 px-3 py-2 text-sm outline-none"
        />
        <button
          disabled={creating || !newName.trim()}
          onClick={async () => {
            setCreating(true);
            try {
              const created = await apiFetch<{ id: string }>("/pipelines", {
                method: "POST",
                body: JSON.stringify({ name: newName.trim() }),
              });
              window.location.href = `/pipelines/${created.id}`;
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not create pipeline");
              setCreating(false);
            }
          }}
          className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--on-primary)] disabled:opacity-50"
        >
          {creating ? "Creating…" : "New pipeline"}
        </button>
      </div>

      {error && (
        <div className="panel mt-5 border-[var(--danger)] p-4 text-sm text-[var(--danger)]">
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
                    <td>
                      <a
                        href={`/pipelines/${p.id}`}
                        className="font-medium hover:text-[var(--primary)] hover:underline"
                      >
                        {p.name}
                      </a>
                    </td>
                    <td className="muted text-xs">{versions ? versions.length : "—"}</td>
                    <td>
                      {!versions ? (
                        <a
                          href={`/pipelines/${p.id}`}
                          className="chip hover:border-[var(--primary)]"
                        >
                          open builder
                        </a>
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
        This list loads pipeline rows only; version history and published snapshots are
        on each pipeline's builder page.
      </p>
    </div>
  );
}
