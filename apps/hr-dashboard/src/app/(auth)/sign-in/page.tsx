"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Field } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { authClient, useSession } from "@/lib/auth-client";
import { nextPath } from "@/lib/next-path";

export default function SignInPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.user) router.replace(nextPath());
  }, [session?.user, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError(error.message ?? "Sign-in failed. Check your email and password.");
      setBusy(false);
      return;
    }
    router.replace(nextPath());
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-fg">Sign in to review candidates and manage interviews.</p>
      </div>

      {error && <Alert variant="danger" title={error} />}

      <form onSubmit={submit} className="space-y-4" noValidate={false}>
        <Field label="Work email" required>
          <Input name="email" type="email" autoComplete="email" placeholder="you@company.com" required autoFocus />
        </Field>
        <Field label="Password" required>
          <PasswordInput name="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-fg">
        New to Intervue AI?{" "}
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
