"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "./lib/cn";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" };

function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-primary-subtle font-semibold text-primary",
        sizes[size],
        className,
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback className="grid size-full place-items-center" aria-label={name}>
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
