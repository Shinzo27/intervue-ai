"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "./lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
        className,
      )}
      {...props}
    />
  );
}

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  size?: "sm" | "md" | "lg";
  hideClose?: boolean;
}

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

export function DialogContent({
  className,
  children,
  size = "md",
  hideClose = false,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface text-fg shadow-lg focus:outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in",
          sizes[size],
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-muted-fg transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 px-6 pb-2 pr-12 pt-6", className)} {...props} />;
}

export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-y-auto px-6 py-3", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 px-6 pb-6 pt-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn("text-lg font-semibold leading-7", className)} {...props} />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted-fg", className)} {...props} />;
}
