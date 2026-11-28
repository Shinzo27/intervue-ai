"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Field } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD = 8;

function strength(password: string): { label: string; tone: string; width: string } {
  let score = 0;
  if (password.length >= MIN_PASSWORD) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { label: "Weak", tone: "bg-danger", width: "25%" };
  if (score === 2) return { label: "Fair", tone: "bg-warning", width: "50%" };
  if (score === 3) return { label: "Good", tone: "bg-primary", width: "75%" };
  return { label: "Strong", tone: "bg-success", width: "100%" };
}

export default function SignUpPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (password.length < MIN_PASSWORD) {
      setPasswordError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setPasswordError(null);
    setBusy(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      email: String(form.get("email")).trim(),
      password,
    });
    if (error) {
      setError(error.message ?? "Couldn't create your account. Try again.");
      setBusy(false);
      return;
    }
    router.replace("/onboarding");
  }

  const meter = strength(password);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-fg">Set up your hiring workspace in about two minutes.</p>
      </div>

      {error && <Alert variant="danger" title={error} />}

      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" required>
          <Input name="name" autoComplete="name" placeholder="Ada Lovelace" required autoFocus />
        </Field>
        <Field label="Work email" required>
          <Input name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
        </Field>
        <Field
          label="Password"
          required
          error={passwordError}
          hint={`At least ${MIN_PASSWORD} characters. Longer is stronger.`}
        >
          <PasswordInput
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {password && (
          <div className="-mt-1 flex items-center gap-3" aria-live="polite">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full transition-all duration-300 ${meter.tone}`} style={{ width: meter.width }} />
            </div>
            <span className="text-xs font-medium text-muted-fg">{meter.label}</span>
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-fg">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
