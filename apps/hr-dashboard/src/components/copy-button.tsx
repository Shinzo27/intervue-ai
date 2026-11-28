"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, IconButton } from "@repo/ui/button";
import { toast } from "@repo/ui/toast";

async function copy(text: string, what: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
    return true;
  } catch {
    toast.error("Couldn't copy", "Select the text and copy it manually.");
    return false;
  }
}

/** Copy text to the clipboard with visible confirmation. */
export function CopyButton({ text, label = "Copy link", what = "Link" }: { text: string; label?: string; what?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        if (await copy(text, what)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
    </Button>
  );
}

export function CopyIconButton({ text, label, what = "Link" }: { text: string; label: string; what?: string }) {
  return (
    <IconButton aria-label={label} size="sm" onClick={() => copy(text, what)} className="relative z-10">
      <Copy />
    </IconButton>
  );
}
