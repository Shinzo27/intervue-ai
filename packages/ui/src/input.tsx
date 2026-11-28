"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./lib/cn";
import { useFieldControl } from "./field";

export const controlClasses =
  "w-full rounded-md border border-input bg-surface px-3 text-sm text-fg shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-subtle-fg focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70 read-only:bg-surface-2 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/25";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = "text", ...props }, ref) {
    const control = useFieldControl(props);
    return (
      <input ref={ref} type={type} className={cn(controlClasses, "h-9", className)} {...control} />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  const control = useFieldControl(props);
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlClasses, "min-h-20 resize-y py-2 leading-5", className)}
      {...control}
    />
  );
});
