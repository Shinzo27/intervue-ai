"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◱" },
  { href: "/jobs", label: "Jobs", icon: "▤" },
  { href: "/pipelines", label: "Pipelines", icon: "⑃" },
  { href: "/applications", label: "Applications", icon: "◫" },
  { href: "/audit", label: "Audit", icon: "⧉" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-sm font-bold text-[var(--accent-fg)]">
          IA
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Intervue AI</div>
          <div className="muted text-[11px]">Recruiter console</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-[var(--panel-2)] font-medium text-[var(--fg)]"
                  : "muted hover:bg-[var(--panel-2)] hover:text-[var(--fg)]"
              }`}
            >
              <span className="w-4 text-center opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
