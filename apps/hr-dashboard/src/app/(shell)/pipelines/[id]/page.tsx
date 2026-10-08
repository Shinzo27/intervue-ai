"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { StageEditor, type Stage } from "./stage-editor";

interface Pipeline {
  id: string;
  name: string;
  status: string;
  stages: Stage[];
}

interface Version {
  id: string;
  version: number;
  status: string;
  publishedAt: string;
  stageCount: number;
  questionCount: number;
  jobCount: number;
}

export default function PipelineBuilderPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, v] = await Promise.all([
        apiFetch<Pipeline>(`/pipelines/${id}`),
        apiFetch<Version[]>(`/pipelines/${id}/versions`),
      ]);
      setPipeline(p);
      setVersions(v);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish() {
    if (!id) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await apiFetch<Version>(`/pipelines/${id}/publish`, {
        method: "POST",
      });
      setNotice(
        `Published v${created.version} — ${created.stageCount} stage(s), ${created.questionCount} question(s) frozen.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted text-sm">Loading pipeline…</p>;
  if (!pipeline)
    return (
      <div className="panel border-[var(--fail)] p-4 text-sm text-[var(--fail)]">
        {error ?? "Pipeline not found"}
      </div>
    );

  const latest = versions[0];

  return (
    <div className="mx-auto max-w-5xl">
      <a href="/pipelines" className="muted text-xs hover:underline">
        ← Pipelines
      </a>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{pipeline.name}</h1>
          <p className="muted mt-1 text-xs">
            {pipeline.stages.length} stages ·{" "}
            {pipeline.stages.reduce((n, s) => n + s.questions.length, 0)} questions in
            the draft
          </p>
        </div>
        <div className="flex items-center gap-2">
          {latest && <span className="chip chip-pass">latest published v{latest.version}</span>}
          <button
            onClick={publish}
            disabled={busy}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-60"
          >
            {busy ? "Publishing…" : "Publish version"}
          </button>
        </div>
      </header>

      {/* The draft/snapshot distinction is the point of this screen (§10, §48). */}
      <div className="panel mt-4 border-[var(--warn)] p-3 text-xs">
        <strong>You are editing the draft template.</strong>{" "}
        <span className="muted">
          Published versions are immutable snapshots — jobs already pinned to an older
          version keep using it, so editing this draft can never change a running
          interview.
        </span>
      </div>

      {notice && (
        <p className="mt-3 text-xs text-[var(--pass)]">{notice}</p>
      )}
      {error && <p className="mt-3 text-xs text-[var(--fail)]">{error}</p>}

      <section className="panel mt-4 overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-medium">
          Published snapshots
        </div>
        {versions.length === 0 ? (
          <p className="muted p-4 text-xs">
            Nothing published yet — publish to freeze this draft for a job.
          </p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Version</th>
                <th>Stages</th>
                <th>Questions</th>
                <th>Jobs pinned</th>
                <th>Published</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className="chip">v{v.version}</span>
                  </td>
                  <td className="text-xs">{v.stageCount}</td>
                  <td className="text-xs">{v.questionCount}</td>
                  <td className="text-xs">{v.jobCount}</td>
                  <td className="muted text-xs">
                    {new Date(v.publishedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 space-y-4">
        {pipeline.stages
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((stage) => (
            <StageEditor
              key={stage.id}
              pipelineId={pipeline.id}
              stage={stage}
              stageCount={pipeline.stages.length}
              onChanged={load}
            />
          ))}
      </section>

      <AddStage pipelineId={pipeline.id} nextOrder={pipeline.stages.length + 1} onChanged={load} />
    </div>
  );
}

function AddStage({
  pipelineId,
  nextOrder,
  onChanged,
}: {
  pipelineId: string;
  nextOrder: number;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="panel mt-4 flex items-center gap-2 p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`New stage name (order ${nextOrder})…`}
        className="panel-2 flex-1 px-3 py-2 text-sm outline-none"
      />
      <button
        disabled={busy || !name.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            await apiFetch(`/pipelines/${pipelineId}/stages`, {
              method: "POST",
              body: JSON.stringify({ name: name.trim(), order: nextOrder }),
            });
            setName("");
            onChanged();
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs disabled:opacity-50"
      >
        Add stage
      </button>
    </div>
  );
}
