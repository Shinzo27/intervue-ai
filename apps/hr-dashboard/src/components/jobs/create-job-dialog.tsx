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
import { Input, Textarea } from "@repo/ui/input";
import { Select } from "@repo/ui/select";
import { toast } from "@repo/ui/toast";
import { apiFetch } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { PipelineSummary } from "@/lib/types";

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: PipelineSummary[];
}

export function CreateJobDialog({ open, onOpenChange, pipelines }: CreateJobDialogProps) {
  const router = useRouter();
  const [pipelineId, setPipelineId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const description = String(form.get("description") ?? "").trim();
      const job = await apiFetch<{ id: string }>("/job-postings", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title")).trim(),
          ...(description ? { description } : {}),
          ...(pipelineId ? { pipelineId } : {}),
        }),
      });
      toast.success("Job created", "It's a draft until you publish it.");
      router.push(`/jobs/${job.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New job</DialogTitle>
            <DialogDescription>Starts as a draft. Publishing freezes the pipeline it uses.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {error && <Alert variant="danger" title={error} />}
            <Field label="Job title" required>
              <Input name="title" placeholder="Senior backend engineer" required autoFocus />
            </Field>
            <Field label="Description" hint="Shown to candidates before they start.">
              <Textarea name="description" rows={3} placeholder="What the role involves and what you're looking for." />
            </Field>
            <Field
              label="Interview pipeline"
              hint={pipelines.length ? "You can change it until the job is published." : "Create a pipeline first; you can attach it later."}
            >
              <Select
                value={pipelineId}
                onValueChange={setPipelineId}
                placeholder={pipelines.length ? "Choose a pipeline" : "No pipelines yet"}
                disabled={pipelines.length === 0}
                options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
