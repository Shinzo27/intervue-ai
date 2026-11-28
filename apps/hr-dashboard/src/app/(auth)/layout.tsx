import type { ReactNode } from "react";
import { CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";
import { Badge } from "@repo/ui/badge";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { BrandMark } from "@/components/auth/brand-mark";

const CRITERIA = [
  { name: "Problem decomposition", score: 4, max: 5 },
  { name: "Trade-off reasoning", score: 3, max: 5 },
  { name: "Communication", score: 5, max: 5 },
];

/** Split-screen frame for sign-in and sign-up: form left, product proof right. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <BrandMark subtitle="Recruiter console" />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <footer className="text-xs text-subtle-fg">Every AI action is permission-checked and audited.</footer>
      </div>

      <aside
        aria-hidden
        className="relative hidden overflow-hidden border-l border-border bg-surface-2 lg:flex lg:flex-col lg:justify-center lg:px-14"
      >
        <div className="max-w-md space-y-8">
          <div className="space-y-3">
            <Badge variant="ai" dot>
              AI interviewer · human decision
            </Badge>
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-fg">
              Interviews run by AI.
              <br />
              Decisions made by people.
            </h2>
            <p className="text-base text-muted-fg">
              Every answer is scored against your rubric by two models. You see the evidence, and you have the final
              say.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-fg">Example evaluation</p>
                <p className="text-xs text-muted-fg">Backend engineer · Stage 2 of 3</p>
              </div>
              <span className="tabular font-mono text-2xl font-semibold text-fg">80</span>
            </div>
            <ul className="mt-4 space-y-3">
              {CRITERIA.map((c) => (
                <li key={c.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-fg">{c.name}</span>
                    <span className="tabular font-mono text-fg">
                      {c.score}/{c.max}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(c.score / c.max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              <Badge variant="success">
                <CheckCircle2 /> Models agree
              </Badge>
              <Badge variant="ai">AI recommends: Pass</Badge>
            </div>
          </div>

          <ul className="space-y-3 text-sm text-muted-fg">
            <li className="flex gap-3">
              <UserCheck className="size-5 shrink-0 text-primary" />
              The AI can recommend, but never overrides a human decision.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="size-5 shrink-0 text-primary" />
              Candidates need no account; their link opens only their own interview.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
