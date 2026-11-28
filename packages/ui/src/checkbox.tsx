"use client";

import type { ComponentProps } from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn } from "./lib/cn";
import { useFieldControl } from "./field";

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  const control = useFieldControl(props);
  return (
    <CheckboxPrimitive.Root
      {...control}
      className={cn(
        "peer grid size-[18px] shrink-0 place-items-center rounded-sm border border-input bg-surface text-on-primary shadow-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary aria-[invalid=true]:border-danger",
        // 44px touch target without changing the visual size.
        "relative after:absolute after:-inset-3 after:content-['']",
        className,
      )}
    >
      <CheckboxPrimitive.Indicator>
        {props.checked === "indeterminate" ? (
          <Minus className="size-3.5" strokeWidth={3} aria-hidden />
        ) : (
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
