"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface AuditEvent {
  id: string;
  organizationId: string;
  actorType: "USER" | "AI" | "SYSTEM";
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const FILTERS = ["ALL", "USER", "AI", "SYSTEM"] as const;

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter === "ALL" ? "" : `&actorType=${filter}`;
      setEvents(await apiFetch<AuditEvent[]>(`/audit?limit=100${query}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit history");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Audit history</h1>
      <p className="muted mt-1 text-sm">
        Every important action — human and AI — with the actor that produced it. AI
        actions are distinguishable from human ones by design.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? "chip chip-pass" : "chip hover:border-[var(--primary)]"}
          >
            {f.toLowerCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="panel mt-4 border-[var(--danger)] p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <section className="panel mt-4 overflow-hidden">
        {loading ? (
          <p className="muted p-4 text-sm">Loading…</p>
        ) : events.length === 0 ? (
          <p className="muted p-4 text-sm">No audit events for this filter.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="muted whitespace-nowrap text-xs">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span
                      className={
                        e.actorType === "AI"
                          ? "chip chip-warn"
                          : e.actorType === "SYSTEM"
                            ? "chip"
                            : "chip chip-pass"
                      }
                    >
                      {e.actorType}
                    </span>
                    <div className="muted mt-1 max-w-40 truncate text-[11px]">
                      {e.actorId ?? "—"}
                    </div>
                  </td>
                  <td className="text-xs font-medium">{e.action}</td>
                  <td className="muted text-xs">
                    {e.entityType}
                    <div className="max-w-32 truncate text-[11px]">{e.entityId}</div>
                  </td>
                  <td className="muted max-w-72 text-[11px]">
                    {e.metadata ? JSON.stringify(e.metadata).slice(0, 140) : "—"}
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
