import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`h-11 w-full rounded-(--radius-input) border border-(--border) bg-(--surface-input) px-4 text-[13px] text-(--text-primary) outline-none transition-colors duration-200 placeholder:text-(--text-muted) focus:border-(--border-strong) ${className}`}
      {...props}
    />
  );
}
