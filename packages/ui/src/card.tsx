import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-(--radius-card) border border-(--border) bg-(--surface) ${className}`}
    >
      {children}
    </div>
  );
}
