"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "./lib/cn";
import { DialogOverlay } from "./dialog";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  side?: "right" | "left";
  width?: "sm" | "md" | "lg";
}

const widths = { sm: "max-w-xs", md: "max-w-md", lg: "max-w-xl" };

/** Side drawer: forms that keep page context (invite candidate) and the mobile nav. */
export function SheetContent({
  className,
  children,
  side = "right",
  width = "md",
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full flex-col border-border bg-surface text-fg shadow-lg focus:outline-none data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in",
          side === "right"
            ? "right-0 border-l"
            : "left-0 border-r data-[state=closed]:animate-sheet-out-left data-[state=open]:animate-sheet-in-left",
          widths[width],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-muted-fg transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1 border-b border-border px-6 py-5 pr-12", className)} {...props} />
  );
}

export function SheetBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex justify-end gap-2 border-t border-border px-6 py-4", className)}
      {...props}
    />
  );
}
