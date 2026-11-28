import { Link2, ShieldCheck, Sparkles } from "lucide-react";
import { ThemeToggle } from "@repo/ui/theme-toggle";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-on-primary">
            <Sparkles className="size-[18px]" aria-hidden />
          </span>
          <span className="text-base font-bold tracking-tight">Intervue AI</span>
        </span>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 pb-16">
        <h1 className="text-3xl font-bold tracking-tight">Your interview starts from your link</h1>
        <p className="mt-3 text-base text-muted-fg">
          This is where candidates take their interview. There&apos;s no account to create: the personal link in your
          invitation email opens your interview directly.
        </p>
        <ul className="mt-8 space-y-4">
          <li className="flex gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <Link2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Have a link?</p>
              <p className="text-sm text-muted-fg">
                It looks like <code className="rounded bg-surface-2 px-1 font-mono text-[13px]">/interview/your-code</code>.
                Open it in this browser. If you&apos;ve started already, you&apos;ll continue where you left off.
              </p>
            </div>
          </li>
          <li className="flex gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Can&apos;t find it?</p>
              <p className="text-sm text-muted-fg">Reply to your invitation email and the hiring team will send a new one.</p>
            </div>
          </li>
        </ul>
      </main>
    </div>
  );
}
