import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-(--radius-button) px-4 py-2.5 text-[13px] font-medium transition-all duration-200 ease-out hover:-translate-y-px disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    primary: "bg-(--accent) text-(--accent-text) hover:brightness-105",
    secondary:
      "border border-(--border-strong) bg-(--surface) text-(--text-primary) hover:bg-(--surface-elevated)",
    ghost: "text-(--text-secondary) hover:text-(--text-primary)",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
