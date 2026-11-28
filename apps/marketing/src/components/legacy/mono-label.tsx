import type { ReactNode } from "react";

interface MonoLabelProps {
  children: ReactNode;
  className?: string;
  accent?: boolean;
}

export function MonoLabel({
  children,
  className = "",
  accent = false,
}: MonoLabelProps) {
  return (
    <span
      className={`font-mono text-[11px] leading-[1.3] tracking-[0.08em] ${
        accent ? "text-(--accent)" : "text-(--text-muted)"
      } ${className}`}
    >
      {children}
    </span>
  );
}
