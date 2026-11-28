"use client";

import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "./lib/cn";
import { useLinkComponent } from "./link-context";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const Link = useLinkComponent();
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className={cn("min-w-0", !last && "hidden sm:block")}>
                {item.href && !last ? (
                  <Link
                    href={item.href}
                    className="truncate text-muted-fg transition-colors hover:text-fg"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className="block truncate font-medium text-fg">
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden className="hidden text-subtle-fg sm:block">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
