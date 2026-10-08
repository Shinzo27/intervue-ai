"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface Job {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  pipeline: { id: string; name: string } | null;
  pipelineVersion: { id: string; version: number; publishedAt: string } | null;
}

interface Application {
  id: string;
  status: string;
  inviteToken: string;
  jobPostingId: string;
  createdAt: string;
  candidate: { firstName: string; lastName: string; email: string };
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [job, setJob] = useState<Job | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState({ firstName: "", lastName: "", email: "" });
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [j, all] = await Promise.all([
        apiFetch<Job>(`/job-postings/${id}`),
        apiFetch<Application[]>("/applications"),
      ]);
      setJob(j);
      setApps(all.filter((a) => a.jobPostingId === id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/job-postings/${id}/publish`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  /** Invite → create the interview session → show the candidate link. */
  async function inviteCandidate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInviteLink(null);
    try {
      const application = await apiFetch<{ id: string; inviteToken: string }>(
        "/applications/invite",
        {
          method: "POST",
          body: JSON.stringify({ ...invite, jobPostingId: id }),
        },
      );

      await apiFetch("/interviews", {
        method: "POST",
        body: JSON.stringify({ applicationId: application.id }),
      });

      setInviteLink(`http://localhost:3003/interview/${application.inviteToken}`);
      setInvite({ firstName: "", lastName: "", email: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted text-sm">Loading job…</p>;
  if (!job)
    return (
      <div className="panel border-[var(--fail)] p-4 text-sm text-[var(--fail)]">
        {error ?? "Job not found"}
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl">
      <a href="/jobs" className="muted text-xs hover:underline">
        ← Jobs
      </a>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{job.title}</h1>
          <p className="muted mt-1 text-xs">
            {job.status === "PUBLISHED"
              ? `configuration frozen at pipeline v${job.pipelineVersion?.version ?? "?"} — later edits to the template cannot change this job`
              : job.pipeline
                ? `draft using template “${job.pipeline.name}” — publishing freezes it`
                : "no pipeline attached yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              job.status === "PUBLISHED"
                ? "chip chip-pass"
                : job.status === "CLOSED"
                  ? "chip chip-fail"
                  : "chip"
            }
          >
            {job.status}
          </span>
          {job.status === "DRAFT" && (
            <button
              onClick={publish}
              disabled={busy}
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-60"
            >
              {busy ? "Publishing…" : "Publish job"}
            </button>
          )}
        </div>
      </header>

      {error && <p className="mt-3 text-xs text-[var(--fail)]">{error}</p>}

      {job.status === "DRAFT" && (
        <div className="panel mt-4 border-[var(--warn)] p-3 text-xs">
          Publishing freezes the pipeline into an immutable snapshot for this job —
          later edits to the pipeline template will not affect it.
        </div>
      )}

      <section className="panel mt-5 p-4">
        <h2 className="text-sm font-medium">Invite a candidate</h2>
        <p className="muted mt-1 text-xs">
          No candidate account is needed — the link below is their interview.
        </p>

        <form onSubmit={inviteCandidate} className="mt-3 flex flex-wrap gap-2">
          <input
            required
            value={invite.firstName}
            onChange={(e) => setInvite({ ...invite, firstName: e.target.value })}
            placeholder="First name"
            className="panel-2 w-40 px-3 py-2 text-sm outline-none"
          />
          <input
            required
            value={invite.lastName}
            onChange={(e) => setInvite({ ...invite, lastName: e.target.value })}
            placeholder="Last name"
            className="panel-2 w-40 px-3 py-2 text-sm outline-none"
          />
          <input
            required
            type="email"
            value={invite.email}
            onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            placeholder="candidate@email.com"
            className="panel-2 min-w-56 flex-1 px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={busy || job.status !== "PUBLISHED"}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50"
          >
            {busy ? "Inviting…" : "Invite"}
          </button>
        </form>

        {job.status !== "PUBLISHED" && (
          <p className="muted mt-2 text-[11px]">
            Publish the job before inviting candidates.
          </p>
        )}

        {inviteLink && (
          <div className="panel-2 mt-3 p-3 text-xs">
            <p className="font-medium">Interview link created</p>
            <a
              href={inviteLink}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-[var(--accent)] hover:underline"
            >
              {inviteLink}
            </a>
            <p className="muted mt-1 text-[11px]">
              Candidates open this — no account required.
            </p>
          </div>
        )}
      </section>

      <section className="panel mt-5 overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-medium">
          Applications ({apps.length})
        </div>
        {apps.length === 0 ? (
          <p className="muted p-4 text-sm">No candidates invited yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Status</th>
                <th>Invited</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.candidate.firstName} {a.candidate.lastName}
                    <div className="muted text-xs">{a.candidate.email}</div>
                  </td>
                  <td>
                    <span className="chip">{a.status}</span>
                  </td>
                  <td className="muted text-xs">
                    {new Date(a.createdAt).toLocaleDateString()}
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
