"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Field } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/sheet";
import { CopyButton } from "@/components/copy-button";
import { apiFetch } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { interviewLink } from "@/lib/urls";

interface InviteCandidateSheetProps {
  jobId: string;
  jobTitle: string;
  trigger: ReactNode;
  onInvited: () => void | Promise<void>;
}

/** Invite → create the interview session → hand back the candidate's link. */
export function InviteCandidateSheet({ jobId, jobTitle, trigger, onInvited }: InviteCandidateSheetProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; link: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const candidate = {
      firstName: String(form.get("firstName")).trim(),
      lastName: String(form.get("lastName")).trim(),
      email: String(form.get("email")).trim(),
    };
    setBusy(true);
    setError(null);
    try {
      const application = await apiFetch<{ id: string; inviteToken: string }>("/applications/invite", {
        method: "POST",
        body: JSON.stringify({ ...candidate, jobPostingId: jobId }),
      });
      await apiFetch("/interviews", {
        method: "POST",
        body: JSON.stringify({ applicationId: application.id }),
      });
      setResult({ name: candidate.firstName, link: interviewLink(application.inviteToken) });
      await onInvited();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setResult(null);
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">Invite a candidate</SheetTitle>
          <SheetDescription className="text-sm text-muted-fg">
            For {jobTitle}. Candidates don&apos;t need an account: their link opens only their interview.
          </SheetDescription>
        </SheetHeader>

        {result ? (
          <>
            <SheetBody className="space-y-5">
              <div className="flex flex-col items-center gap-3 rounded-lg bg-success-subtle px-4 py-6 text-center">
                <CheckCircle2 className="size-8 text-success" aria-hidden />
                <div>
                  <p className="font-semibold text-fg">{result.name} is invited</p>
                  <p className="text-sm text-muted-fg">An invitation email is queued. You can also share the link yourself.</p>
                </div>
              </div>
              <Field label="Interview link">
                <Input readOnly value={result.link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              </Field>
              <CopyButton text={result.link} label="Copy interview link" />
            </SheetBody>
            <SheetFooter>
              <Button variant="secondary" onClick={() => setResult(null)}>
                <UserPlus /> Invite another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </SheetFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <SheetBody className="space-y-4">
              {error && <Alert variant="danger" title={error} />}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" required>
                  <Input name="firstName" autoComplete="off" required autoFocus />
                </Field>
                <Field label="Last name" required>
                  <Input name="lastName" autoComplete="off" required />
                </Field>
              </div>
              <Field label="Email" required hint="The interview link is sent here.">
                <Input name="email" type="email" autoComplete="off" placeholder="candidate@email.com" required />
              </Field>
            </SheetBody>
            <SheetFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Create invitation
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
