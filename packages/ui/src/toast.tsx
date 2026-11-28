"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "./lib/cn";

type ToastTone = "info" | "success" | "warning" | "danger";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: ReactNode;
  description?: ReactNode;
  open: boolean;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function push(tone: ToastTone, title: ReactNode, description?: ReactNode) {
  items = [...items, { id: nextId++, tone, title, description, open: true }].slice(-4);
  emit();
}

/** Fire-and-forget notifications. Render <Toaster /> once near the app root. */
export const toast = {
  info: (title: ReactNode, description?: ReactNode) => push("info", title, description),
  success: (title: ReactNode, description?: ReactNode) => push("success", title, description),
  warning: (title: ReactNode, description?: ReactNode) => push("warning", title, description),
  error: (title: ReactNode, description?: ReactNode) => push("danger", title, description),
};

function close(id: number) {
  items = items.map((item) => (item.id === id ? { ...item, open: false } : item));
  emit();
  window.setTimeout(() => {
    items = items.filter((item) => item.id !== id);
    emit();
  }, 200);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };
const iconTone = {
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => items);
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
      {list.map((item) => {
        const Icon = icons[item.tone];
        return (
          <ToastPrimitive.Root
            key={item.id}
            open={item.open}
            onOpenChange={(open) => !open && close(item.id)}
            type={item.tone === "danger" ? "foreground" : "background"}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-4 text-fg shadow-lg data-[state=closed]:animate-fade-out data-[state=open]:animate-pop-in data-[swipe=end]:animate-fade-out data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)",
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", iconTone[item.tone])} aria-hidden />
            <div className="flex-1 space-y-0.5">
              <ToastPrimitive.Title className="text-sm font-semibold leading-5">{item.title}</ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="text-[13px] leading-5 text-muted-fg">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="-m-1 grid size-7 place-items-center rounded-md text-muted-fg hover:bg-surface-hover hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[60] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </ToastPrimitive.Provider>
  );
}
