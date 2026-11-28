"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Monitor, Moon, Sparkles, Sun } from "lucide-react";
import { AppShell } from "@repo/ui/app-shell";
import { Breadcrumbs } from "@repo/ui/breadcrumbs";
import { CommandPalette, CommandPaletteTrigger, type CommandGroup } from "@repo/ui/command-palette";
import { LinkProvider } from "@repo/ui/link-context";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { useTheme } from "@repo/ui/theme";
import { authClient } from "@/lib/auth-client";
import { NAV, crumbsFor } from "./nav";
import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";

function Brand({ compact }: { compact: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md" aria-label="Intervue AI home">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-on-primary shadow-sm">
        <Sparkles className="size-4" aria-hidden />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-tight text-fg">Intervue AI</span>
          <span className="block text-[11px] font-medium text-muted-fg">Recruiter console</span>
        </span>
      )}
    </Link>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { setPreference } = useTheme();

  const commands: CommandGroup[] = [
    {
      heading: "Go to",
      items: NAV.flatMap((section) =>
        section.items.map((item) => ({
          id: item.href,
          label: item.label,
          icon: item.icon,
          onSelect: () => router.push(item.href),
        })),
      ),
    },
    {
      heading: "Preferences",
      items: [
        { id: "theme-light", label: "Use light theme", icon: Sun, onSelect: () => setPreference("light") },
        { id: "theme-dark", label: "Use dark theme", icon: Moon, onSelect: () => setPreference("dark") },
        { id: "theme-system", label: "Match system theme", icon: Monitor, onSelect: () => setPreference("system") },
        {
          id: "sign-out",
          label: "Sign out",
          icon: LogOut,
          onSelect: async () => {
            await authClient.signOut();
            window.location.assign("/");
          },
        },
      ],
    },
  ];

  return (
    <LinkProvider value={Link}>
      <AppShell
        brand={(compact) => <Brand compact={compact} />}
        nav={NAV}
        currentPath={pathname}
        header={
          <>
            <OrgSwitcher />
            <Breadcrumbs items={crumbsFor(pathname)} className="hidden lg:block" />
            <div className="ml-auto flex items-center gap-1.5">
              <CommandPaletteTrigger className="hidden w-56 md:flex" />
              <ThemeToggle />
              <UserMenu />
            </div>
          </>
        }
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </AppShell>
      <CommandPalette groups={commands} />
    </LinkProvider>
  );
}
