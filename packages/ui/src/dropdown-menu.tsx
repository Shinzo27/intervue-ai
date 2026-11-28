"use client";

import type { ComponentProps } from "react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "./lib/cn";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "end",
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-surface p-1 text-fg shadow-md data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

const itemClasses =
  "relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-hover data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-fg";

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(itemClasses, destructive && "text-danger [&_svg]:text-danger", className)}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn(itemClasses, "pr-8", className)} {...props}>
      {children}
      <MenuPrimitive.ItemIndicator className="absolute right-2 inline-flex">
        <Check className="text-primary!" aria-hidden />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-fg", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
