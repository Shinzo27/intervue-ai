import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "accent";
}

export function Badge({
  children,
  className = "",
  variant = "default",
}: BadgeProps) {
  const variants = {
    default:
      "border-(--border) bg-(--surface-elevated) text-(--text-secondary)",
    accent: "border-transparent bg-(--accent) text-(--accent-text)",
  };

  return (
    <span
      className={`inline-flex items-center rounded-(--radius-tag) border px-2 py-1 font-mono text-[10px] leading-[1.3] ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
