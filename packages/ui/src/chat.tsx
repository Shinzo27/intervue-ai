"use client";

import { forwardRef, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { cn } from "./lib/cn";

interface ChatBubbleProps {
  role: "ai" | "candidate";
  children: ReactNode;
  /** Accessible speaker name, e.g. "AI interviewer" or the candidate's name. */
  author?: string;
  streaming?: boolean;
  className?: string;
}

export function ChatBubble({ role, children, author, streaming = false, className }: ChatBubbleProps) {
  const ai = role === "ai";
  return (
    <div className={cn("flex gap-2.5", ai ? "justify-start" : "justify-end", className)}>
      {ai && (
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-ai-subtle text-ai" aria-hidden>
          <Sparkles className="size-4" />
        </span>
      )}
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-6 sm:max-w-[75%]",
          ai ? "rounded-tl-md border border-border bg-surface text-fg shadow-sm" : "rounded-tr-md bg-primary text-on-primary",
        )}
      >
        {author && <span className="sr-only">{author}: </span>}
        {children}
        {streaming && <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-current opacity-60" />}
      </div>
    </div>
  );
}

/** Three-dot "the AI is writing" indicator. */
export function TypingIndicator({ label = "The interviewer is typing" }: { label?: string }) {
  return (
    <div className="flex gap-2.5" role="status" aria-label={label}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ai-subtle text-ai" aria-hidden>
        <Sparkles className="size-4" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3.5 shadow-sm">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden
            className="size-1.5 animate-bounce rounded-full bg-muted-fg"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

interface ComposerProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onSubmit"> {
  onSend: () => void;
  sending?: boolean;
  canSend: boolean;
}

/**
 * Chat input: Enter sends, Shift+Enter adds a line. IME-safe (Enter that
 * confirms a CJK composition never sends) and keeps a visible send button
 * for touch keyboards.
 */
export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { onSend, sending = false, canSend, className, ...props },
  ref,
) {
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (!event.repeat && canSend && !sending) onSend();
  }

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-input bg-surface p-2 shadow-sm transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/25">
      <textarea
        ref={ref}
        rows={1}
        onKeyDown={onKeyDown}
        className={cn(
          "max-h-48 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base leading-6 text-fg outline-none [field-sizing:content] placeholder:text-subtle-fg",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend || sending}
        aria-label="Send answer"
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowUp className="size-5" aria-hidden />
      </button>
    </div>
  );
});
