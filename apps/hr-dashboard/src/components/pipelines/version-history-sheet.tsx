"use client";

import { History, Lock } from "lucide-react";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@repo/ui/sheet";
import { formatDateTime } from "@/lib/format";
import type { PipelineVersion } from "@/lib/types";

export function VersionHistorySheet({ versions }: { versions: PipelineVersion[] }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary">
          <History /> Versions
          <span className="tabular rounded-sm bg-surface-2 px-1.5 text-xs text-muted-fg">{versions.length}</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">Published versions</SheetTitle>
          <SheetDescription className="text-sm text-muted-fg">
            Each version is an immutable snapshot. Jobs pinned to a version keep it forever.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {versions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-fg">Nothing published yet.</p>
          ) : (
            <ol className="space-y-3">
              {versions.map((version, index) => (
                <li key={version.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold text-fg">
                      <Lock className="size-3.5 text-muted-fg" aria-hidden /> Version {version.version}
                    </span>
                    {index === 0 && <Badge variant="success">Latest</Badge>}
                  </div>
                  <p className="mt-1 text-[13px] text-muted-fg">Published {formatDateTime(version.publishedAt)}</p>
                  <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      ["Stages", version.stageCount],
                      ["Questions", version.questionCount],
                      ["Jobs", version.jobCount],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md bg-surface-2 py-2">
                        <dt className="text-xs text-muted-fg">{label}</dt>
                        <dd className="text-base font-semibold text-fg">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
