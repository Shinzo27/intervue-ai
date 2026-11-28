"use client";

import { useState } from "react";
import { cn } from "@repo/ui/lib/cn";

interface InlineTextProps {
  value: string;
  label: string;
  onSave: (value: string) => Promise<void> | void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}

/** Text that looks like content and edits in place; saves on blur or Enter, Esc cancels. */
export function InlineText({ value, label, onSave, className, multiline = false, placeholder }: InlineTextProps) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    // The saved value changed underneath (after a refresh): adopt it.
    setSynced(value);
    setDraft(value);
  }

  function commit() {
    const next = draft.trim();
    if (!next) {
      setDraft(value);
      return;
    }
    if (next !== value) void onSave(next);
  }

  const classes = cn(
    "w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-fg transition-colors hover:border-border focus-visible:border-primary focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25",
    className,
  );

  return multiline ? (
    <textarea
      aria-label={label}
      value={draft}
      rows={2}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") setDraft(value);
      }}
      className={cn(classes, "resize-y leading-6")}
    />
  ) : (
    <input
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(value);
      }}
      className={classes}
    />
  );
}
