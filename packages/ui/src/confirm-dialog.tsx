"use client";

import { useState, type ReactNode } from "react";
import { AlertDialog as AlertPrimitive } from "radix-ui";
import { cn } from "./lib/cn";
import { Button } from "./button";

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** May return a promise; the dialog shows a spinner and stays open until it settles. */
  onConfirm: () => void | Promise<void>;
}

/** Confirmation for consequential actions (publish, delete, override). */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertPrimitive.Root open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <AlertPrimitive.Trigger asChild>{trigger}</AlertPrimitive.Trigger>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <AlertPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 text-fg shadow-lg focus:outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in",
          )}
        >
          <AlertPrimitive.Title className="text-lg font-semibold leading-7">{title}</AlertPrimitive.Title>
          <AlertPrimitive.Description className="mt-2 text-sm text-muted-fg">
            {description}
          </AlertPrimitive.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertPrimitive.Cancel asChild>
              <Button variant="secondary" disabled={busy}>
                {cancelLabel}
              </Button>
            </AlertPrimitive.Cancel>
            <Button
              variant={destructive ? "destructive" : "primary"}
              loading={busy}
              onClick={confirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}
