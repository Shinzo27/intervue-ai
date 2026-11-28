"use client";

import type { ComponentProps } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "./lib/cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex items-center gap-1 overflow-x-auto border-b border-border", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-muted-fg transition-colors hover:text-fg data-[state=active]:border-primary data-[state=active]:text-fg [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("pt-5 focus-visible:outline-none", className)} {...props} />;
}
