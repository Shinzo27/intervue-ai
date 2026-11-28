"use client";

import type { ComponentProps } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "./lib/cn";
import { useFieldControl } from "./field";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  const control = useFieldControl(props);
  return (
    <SwitchPrimitive.Root
      {...control}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-border-strong transition-colors duration-150 after:absolute after:-inset-3 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
        className,
      )}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}
