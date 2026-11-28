import { Sparkles } from "lucide-react";
import type { Stage } from "@/lib/types";

/** How the selected stage reads to a candidate in the interview chat. */
export function CandidatePreview({ stage, stageNumber, stageCount }: { stage: Stage | undefined; stageNumber: number; stageCount: number }) {
  const questions = stage?.questions.slice().sort((a, b) => a.order - b.order) ?? [];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg shadow-sm">
      <div className="border-b border-border bg-surface px-4 py-3">
        <p className="text-xs font-medium text-muted-fg">Candidate preview</p>
        <p className="truncate text-sm font-semibold text-fg">
          {stage ? `Stage ${stageNumber} of ${stageCount} · ${stage.name}` : "No stage selected"}
        </p>
      </div>
      <div className="max-h-[560px] space-y-3 overflow-y-auto p-4">
        {questions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-fg">Questions you add appear here as the AI will ask them.</p>
        ) : (
          questions.map((question) => (
            <div key={question.id} className="space-y-2">
              <div className="flex gap-2">
                <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-ai-subtle text-ai">
                  <Sparkles className="size-3" aria-hidden />
                </span>
                <p className="rounded-xl rounded-tl-sm border border-border bg-surface px-3 py-2 text-sm leading-6 text-fg">
                  {question.question}
                </p>
              </div>
              {question.type === "MCQ" && question.options.length > 0 && (
                <div className="ml-8 flex flex-wrap gap-1.5">
                  {question.options
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((option) => (
                      <span key={option.id} className="rounded-full border border-border-strong bg-surface px-3 py-1 text-xs text-fg">
                        {option.text}
                      </span>
                    ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border bg-surface p-3">
        <div className="h-9 rounded-md border border-border bg-surface-2 px-3 text-sm leading-9 text-subtle-fg">Type your answer…</div>
      </div>
    </div>
  );
}
