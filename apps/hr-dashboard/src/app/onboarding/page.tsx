"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Plus, Trash2, Users, Workflow } from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Button, IconButton } from "@repo/ui/button";
import { Card, CardContent } from "@repo/ui/card";
import { Field } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { Select } from "@repo/ui/select";
import { Spinner } from "@repo/ui/spinner";
import { Stepper } from "@repo/ui/stepper";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { toast } from "@repo/ui/toast";
import { BrandMark } from "@/components/auth/brand-mark";
import { authClient, useSession } from "@/lib/auth-client";
import { errorMessage } from "@/lib/format";

const STEPS = ["Organization", "Your team", "Get started"];

const ROLES = [
  { value: "admin", label: "Admin — manages members and settings" },
  { value: "recruiter", label: "Recruiter — runs jobs and decisions" },
  { value: "interviewer", label: "Interviewer — reviews and evaluates" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isPending && !session?.user) router.replace("/sign-in?next=/onboarding");
  }, [isPending, session?.user, router]);

  if (isPending || !session?.user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner label="Loading" />
      </div>
    );
  }

  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-6 py-6">
        <BrandMark />
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-2xl space-y-8 px-6 pb-16">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {firstName ? `Welcome, ${firstName}` : "Welcome"} — let&apos;s set up your workspace
          </h1>
          <p className="text-sm text-muted-fg">Three quick steps. You can change everything later.</p>
        </div>
        <Stepper steps={STEPS} current={step} />
        {step === 0 && <OrganizationStep onDone={() => setStep(1)} />}
        {step === 1 && <TeamStep onDone={() => setStep(2)} />}
        {step === 2 && <DoneStep />}
      </main>
    </div>
  );
}

function OrganizationStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const finalSlug = slugify(slug || name);
    if (!name.trim() || !finalSlug) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await authClient.organization.create({ name: name.trim(), slug: finalSlug });
      if (error || !data) throw new Error(error?.message ?? "Couldn't create the organization.");
      await authClient.organization.setActive({ organizationId: data.id });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <StepIntro icon={Building2} title="Name your organization" text="Jobs, pipelines and candidates all live inside it. Your teammates join it too." />
        {error && <Alert variant="danger" title={error} />}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Organization name" required>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) setSlug(slugify(e.target.value));
              }}
              placeholder="Acme Inc."
              required
              autoFocus
            />
          </Field>
          <Field label="URL name" hint="Lowercase letters, numbers and dashes. Must be unique.">
            <Input
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value);
              }}
              onBlur={() => setSlug(slugify(slug))}
              placeholder="acme"
              className="font-mono"
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={busy} disabled={!name.trim()}>
              Create organization <ArrowRight />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface InviteRow {
  id: number;
  email: string;
  role: string;
}

function TeamStep({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<InviteRow[]>([{ id: 1, email: "", role: "recruiter" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(id: number, patch: Partial<InviteRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invites = rows.filter((row) => row.email.trim());
    if (invites.length === 0) return onDone();
    setBusy(true);
    setError(null);
    const failed: string[] = [];
    for (const invite of invites) {
      const { error } = await authClient.organization.inviteMember({
        email: invite.email.trim(),
        role: invite.role as "admin" | "member" | "owner",
      });
      if (error) failed.push(`${invite.email}: ${error.message ?? "failed"}`);
    }
    setBusy(false);
    if (failed.length) {
      setError(failed.join(" · "));
      return;
    }
    toast.success(
      `${invites.length} invitation${invites.length > 1 ? "s" : ""} created`,
      "They'll appear as pending under Team settings.",
    );
    onDone();
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <StepIntro icon={Users} title="Invite your team" text="Optional. Add recruiters and interviewers now, or skip and do it later." />
        {error && <Alert variant="danger" title="Some invitations failed">{error}</Alert>}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_200px_auto] sm:items-end">
                <Field label={index === 0 ? "Email" : `Email ${index + 1}`}>
                  <Input
                    type="email"
                    value={row.email}
                    onChange={(e) => update(row.id, { email: e.target.value })}
                    placeholder="teammate@company.com"
                  />
                </Field>
                <Field label="Role">
                  <Select value={row.role} onValueChange={(role) => update(row.id, { role })} options={ROLES} />
                </Field>
                <IconButton
                  aria-label={`Remove ${row.email || "this row"}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
                >
                  <Trash2 />
                </IconButton>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRows((current) => [...current, { id: Date.now(), email: "", role: "recruiter" }])}
          >
            <Plus /> Add another
          </Button>
          <div className="flex justify-between gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onDone}>
              Skip for now
            </Button>
            <Button type="submit" loading={busy}>
              Send invitations <ArrowRight />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function DoneStep() {
  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <StepIntro
          icon={Workflow}
          title="Build your first interview pipeline"
          text="A pipeline is a reusable interview: stages, questions and the rubric the AI scores against. Publish it, attach it to a job, and invite candidates."
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button asChild>
            <Link href="/pipelines?new=1">
              Create a pipeline <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StepIntro({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return (
    <div className="flex gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-fg">{text}</p>
      </div>
    </div>
  );
}
