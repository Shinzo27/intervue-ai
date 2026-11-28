"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "./lib/cn";
import { DialogOverlay } from "./dialog";
import { Kbd } from "./kbd";

export interface CommandItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  keywords?: string[];
  shortcut?: string;
  onSelect: () => void;
}

export interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

const OPEN_EVENT = "intervue:open-command-palette";

/** Open the palette from anywhere (e.g. a "Search" button). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Global ⌘K / Ctrl+K command palette. Render once per app. */
export function CommandPalette({ groups }: { groups: CommandGroup[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[15vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface text-fg shadow-lg focus:outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search pages and actions. Use arrow keys to move and Enter to run.
          </DialogPrimitive.Description>
          <Command loop className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-muted-fg" aria-hidden />
              <Command.Input
                autoFocus
                placeholder="Search pages and actions…"
                className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle-fg"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-muted-fg">No results.</Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={group.heading}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-fg"
                >
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.id}
                        value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                        onSelect={() => {
                          setOpen(false);
                          item.onSelect();
                        }}
                        className={cn(
                          "flex h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-fg data-[selected=true]:bg-surface-hover",
                        )}
                      >
                        {Icon && <Icon className="size-4 text-muted-fg" aria-hidden />}
                        <span className="flex-1">{item.label}</span>
                        {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Top-bar search field that opens the palette. */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={cn(
        "flex h-9 w-full max-w-xs items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm text-subtle-fg transition-colors hover:border-border-strong hover:text-muted-fg",
        className,
      )}
    >
      <Search className="size-4" aria-hidden />
      <span className="flex-1 text-left">Search…</span>
      <Kbd>⌘K</Kbd>
    </button>
  );
}
