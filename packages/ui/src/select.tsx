"use client";

import type { ComponentProps, ReactNode } from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./lib/cn";
import { useFieldControl } from "./field";

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface SelectProps
  extends Omit<ComponentProps<typeof SelectPrimitive.Root>, "children"> {
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

export function Select({
  options,
  placeholder = "Select…",
  id,
  className,
  "aria-label": ariaLabel,
  ...props
}: SelectProps) {
  const control = useFieldControl({ id });
  return (
    <SelectPrimitive.Root {...props}>
      <SelectPrimitive.Trigger
        {...control}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface px-3 text-sm text-fg shadow-sm transition-[border-color,box-shadow] duration-150 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-subtle-fg aria-[invalid=true]:border-danger",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-muted-fg" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-md border border-border bg-surface p-1 text-fg shadow-md data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex h-8 cursor-pointer select-none items-center rounded-sm pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-hover data-[disabled]:opacity-50"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex">
                  <Check className="size-4 text-primary" aria-hidden />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
