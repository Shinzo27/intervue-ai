"use client";

import { useState } from "react";
import { Bot, ChevronDown, Cog, ScrollText, Search, Sparkles, UserRound } from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent } from "@repo/ui/card";
import { EmptyState } from "@repo/ui/empty-state";
import { Input } from "@repo/ui/input";
import { PageHeader } from "@repo/ui/page-header";
import { Skeleton } from "@repo/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { Timeline, type TimelineItem } from "@repo/ui/timeline";
import { apiFetch } from "@/lib/api";
import { humanizeAction, type AuditEvent } from "@/lib/audit";
import { useResource } from "@/lib/use-resource";

const PAGE = 100;

const ACTORS = [
  { value: "ALL", label: "Everyone", icon: ScrollText },
  { value: "USER", label: "People", icon: UserRound },
  { value: "AI", label: "AI", icon: Sparkles },
  { value: "SYSTEM", label: "System", icon: Cog },
] as const;

type ActorFilter = (typeof ACTORS)[number]["value"];

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function dayLabel(date: Date, today: Date): string {
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return dayFormat.format(date);
}

function metaString(event: AuditEvent): string | null {
  const meta = event.metadata ?? {};
  const tool = typeof meta.tool === "string" ? meta.tool : typeof meta.toolName === "string" ? meta.toolName : null;
  const capability = typeof meta.capability === "string" ? meta.capability : null;
  return [tool && `tool ${tool}`, capability && `capability ${capability}`].filter(Boolean).join(" · ") || null;
}

export default function AuditPage() {
  const [actor, setActor] = useState<ActorFilter>("ALL");
  const [limit, setLimit] = useState(PAGE);
  const [query, setQuery] = useState("");
  const [today] = useState(() => new Date());

  const params = `limit=${limit}${actor === "ALL" ? "" : `&actorType=${actor}`}`;
  const { data, error, loading } = useResource(`audit?${params}`, () => apiFetch<AuditEvent[]>(`/audit?${params}`));

  const needle = query.trim().toLowerCase();
  const events = (data ?? []).filter(
    (e) => !needle || `${e.action} ${e.entityType} ${humanizeAction(e.action)}`.toLowerCase().includes(needle),
  );

  const groups = new Map<string, AuditEvent[]>();
  for (const event of events) {
    const label = dayLabel(new Date(event.createdAt), today);
    groups.set(label, [...(groups.get(label) ?? []), event]);
  }

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Every important action, human or AI, with who did it. AI actions are permission-checked and carry the tool that performed them."
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <Tabs
          value={actor}
          onValueChange={(value) => {
            setActor(value as ActorFilter);
            setLimit(PAGE);
          }}
        >
          <TabsList className="shadow-none">
            {ACTORS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}>
                <Icon /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-fg" aria-hidden />
          <Input
            type="search"
            aria-label="Filter by action"
            placeholder="Filter by action or entity"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {error && <Alert variant="danger" title="Couldn't load the audit trail" className="mb-6">{error}</Alert>}

      {loading && !data ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState icon={ScrollText} title="No events" description="Nothing matches these filters yet." />
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([label, dayEvents]) => (
            <section key={label}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-fg">{label}</h2>
              <Card>
                <CardContent className="p-5">
                  <Timeline items={dayEvents.map(toItem)} />
                </CardContent>
              </Card>
            </section>
          ))}
          {data && data.length >= limit && (
            <div className="flex justify-center">
              <Button variant="secondary" loading={loading} onClick={() => setLimit((n) => n + PAGE)}>
                Load older events
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function toItem(event: AuditEvent): TimelineItem {
  const isAI = event.actorType === "AI";
  const isSystem = event.actorType === "SYSTEM";
  const meta = metaString(event);
  return {
    id: event.id,
    tone: isAI ? "ai" : isSystem ? "neutral" : "primary",
    icon: isAI ? <Bot /> : isSystem ? <Cog /> : <UserRound />,
    title: (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{humanizeAction(event.action)}</span>
        <Badge variant={isAI ? "ai" : isSystem ? "neutral" : "primary"}>{isAI ? "AI" : isSystem ? "System" : "Person"}</Badge>
      </span>
    ),
    meta: (
      <span className="tabular">
        {timeFormat.format(new Date(event.createdAt))} · {event.entityType.toLowerCase()}{" "}
        <span className="font-mono">{event.entityId.slice(0, 8)}</span>
        {meta && ` · ${meta}`}
      </span>
    ),
    children:
      event.metadata && Object.keys(event.metadata).length > 0 ? (
        <details className="group rounded-md border border-border bg-surface-2 text-xs">
          <summary className="flex list-none items-center gap-1.5 px-3 py-2 font-medium text-muted-fg hover:text-fg [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden /> Details
          </summary>
          <pre className="overflow-x-auto border-t border-border px-3 py-2 font-mono text-[12px] leading-5 text-fg">
            {JSON.stringify({ actorId: event.actorId, ...event.metadata }, null, 2)}
          </pre>
        </details>
      ) : undefined,
  };
}
