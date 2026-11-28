"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { RadioGroup as RadioPrimitive } from "radix-ui";
import { cn } from "./lib/cn";
import { Label } from "./field";

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

interface RadioGroupProps extends ComponentProps<typeof RadioPrimitive.Root> {
  options: RadioOption[];
}

export function RadioGroup({ options, className, ...props }: RadioGroupProps) {
  const baseId = useId();
  return (
    <RadioPrimitive.Root className={cn("flex flex-col gap-3", className)} {...props}>
      {options.map((option) => {
        const id = `${baseId}-${option.value}`;
        return (
          <div key={option.value} className="flex items-start gap-2.5">
            <RadioPrimitive.Item
              id={id}
              value={option.value}
              disabled={option.disabled}
              className="relative mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border border-input bg-surface shadow-sm transition-colors duration-150 after:absolute after:-inset-3 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary"
            >
              <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-primary" />
            </RadioPrimitive.Item>
            <div className="space-y-0.5">
              <Label htmlFor={id}>{option.label}</Label>
              {option.description && (
                <p className="text-[13px] leading-5 text-muted-fg">{option.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </RadioPrimitive.Root>
  );
}
