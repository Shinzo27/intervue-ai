"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Field } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { apiFetch } from "@/lib/api";
import { errorMessage } from "@/lib/format";

export function CreatePipelineDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>("/pipelines", { method: "POST", body: JSON.stringify({ name }) });
      router.push(`/pipelines/${created.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New pipeline</DialogTitle>
            <DialogDescription>A reusable interview: stages, questions and the rubric the AI scores against.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {error && <Alert variant="danger" title={error} />}
            <Field label="Pipeline name" required>
              <Input name="name" placeholder="Backend engineering interview" required autoFocus />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create and open builder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
