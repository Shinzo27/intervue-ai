"use client";

import type { ComponentProps } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "./lib/cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-lg border border-border bg-surface p-4 text-fg shadow-md focus:outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
