"use client";

import { useState } from "react";
import { Spinner } from "@repo/ui/spinner";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { authClient, useSession } from "@/lib/auth-client";

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) setError(error.message ?? "Sign-in failed");
    setBusy(false);
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="panel w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="muted mt-1 mb-5 text-xs">
          Recruiter console — sessions are issued by Better Auth.
        </p>

        <label className="muted mb-1 block text-xs">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="panel-2 mb-3 w-full px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          placeholder="you@company.com"
        />

        <label className="muted mb-1 block text-xs">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="panel-2 mb-4 w-full px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          placeholder="••••••••"
        />

        {error && <p className="mb-3 text-xs text-[var(--danger)]">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="flex items-center gap-2 text-sm text-muted-fg">
          <Spinner /> Loading your workspace…
        </span>
      </div>
    );
  }

  if (!session?.user) return <SignIn />;

  return <DashboardShell>{children}</DashboardShell>;
}
