"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "./lib/cn";
import { useMediaQuery } from "./lib/use-media-query";
import { useLinkComponent } from "./link-context";
import { IconButton } from "./button";
import { Sheet, SheetContent, SheetTitle } from "./sheet";
import { Tooltip, TooltipProvider } from "./tooltip";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Small trailing count or status, e.g. items awaiting review. */
  badge?: ReactNode;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

interface AppShellProps {
  /** Logo + product name; `compact` is true when the sidebar shows icons only. */
  brand: (compact: boolean) => ReactNode;
  nav: NavSection[];
  /** Current pathname; an item is active when the path starts with its href. */
  currentPath: string;
  /** Pinned to the bottom of the sidebar (e.g. settings). */
  sidebarFooter?: (compact: boolean) => ReactNode;
  /** Top bar content to the right of the mobile menu button. */
  header: ReactNode;
  children: ReactNode;
}

const COLLAPSE_KEY = "intervue-sidebar-collapsed";

/**
 * Recruiter console frame: 240px sidebar (icons only below 1024px or when
 * collapsed), 56px top bar, drawer navigation below 768px.
 */
export function AppShell({ brand, nav, currentPath, sidebarFooter, header, children }: AppShellProps) {
  const isLarge = useMediaQuery("(min-width: 1024px)", true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Ignore blocked storage.
    }
  }, []);

  // Close the drawer after navigating.
  useEffect(() => setMobileOpen(false), [currentPath]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      // Ignore blocked storage.
    }
  }

  const compact = !isLarge || collapsed;

  return (
    <TooltipProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh bg-bg">
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out md:flex",
            compact ? "w-16" : "w-60",
          )}
        >
          <div className={cn("flex h-14 items-center border-b border-border", compact ? "justify-center" : "px-4")}>
            {brand(compact)}
          </div>
          <SidebarNav nav={nav} currentPath={currentPath} compact={compact} />
          <div className="mt-auto border-t border-border p-2">
            {sidebarFooter?.(compact)}
            {isLarge && (
              <SidebarButton
                compact={compact}
                label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                icon={collapsed ? PanelLeftOpen : PanelLeftClose}
                onClick={toggleCollapsed}
              />
            )}
          </div>
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" width="sm" className="md:hidden">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-14 items-center border-b border-border px-4">{brand(false)}</div>
            <SidebarNav nav={nav} currentPath={currentPath} compact={false} />
            {sidebarFooter && <div className="mt-auto border-t border-border p-2">{sidebarFooter(false)}</div>}
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-5">
            <IconButton aria-label="Open navigation" className="md:hidden" onClick={() => setMobileOpen(true)}>
              <Menu />
            </IconButton>
            <div className="flex min-w-0 flex-1 items-center gap-3">{header}</div>
          </header>
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SidebarNav({
  nav,
  currentPath,
  compact,
}: {
  nav: NavSection[];
  currentPath: string;
  compact: boolean;
}) {
  const Link = useLinkComponent();
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto p-2 pt-4">
      {nav.map((section, index) => (
        <div key={section.label ?? index} className="flex flex-col gap-0.5">
          {section.label && !compact && (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">
              {section.label}
            </p>
          )}
          {section.items.map((item) => {
            const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const link = (
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={compact ? item.label : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-md text-sm font-medium transition-colors duration-150",
                  compact ? "justify-center" : "px-3",
                  active
                    ? "bg-primary-subtle text-primary"
                    : "text-muted-fg hover:bg-surface-hover hover:text-fg",
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                {!compact && <span className="flex-1 truncate">{item.label}</span>}
                {!compact && item.badge}
              </Link>
            );
            return compact ? (
              <Tooltip key={item.href} content={item.label} side="right">
                {link}
              </Tooltip>
            ) : (
              <div key={item.href}>{link}</div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Sidebar-styled button for the footer area (collapse toggle, help, settings actions). */
export function SidebarButton({
  compact,
  label,
  icon: Icon,
  onClick,
}: {
  compact: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={compact ? label : undefined}
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-md text-sm font-medium text-muted-fg transition-colors duration-150 hover:bg-surface-hover hover:text-fg",
        compact ? "justify-center" : "px-3",
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
      {!compact && <span className="truncate">{label}</span>}
    </button>
  );
  return compact ? (
    <Tooltip content={label} side="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}
