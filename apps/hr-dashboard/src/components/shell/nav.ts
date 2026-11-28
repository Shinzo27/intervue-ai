import { ClipboardList, LayoutDashboard, BriefcaseBusiness, ScrollText, Workflow } from "lucide-react";
import type { NavSection } from "@repo/ui/app-shell";

export const NAV: NavSection[] = [
  {
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Hiring",
    items: [
      { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
      { href: "/pipelines", label: "Pipelines", icon: Workflow },
      { href: "/applications", label: "Applications", icon: ClipboardList },
    ],
  },
  {
    label: "Governance",
    items: [{ href: "/audit", label: "Audit trail", icon: ScrollText }],
  },
];

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  jobs: "Jobs",
  pipelines: "Pipelines",
  applications: "Applications",
  audit: "Audit trail",
  settings: "Settings",
  team: "Team",
};

/** Breadcrumbs from the URL: known segments get names, ids become "Details". */
export function crumbsFor(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, index) => ({
    label: SEGMENT_LABELS[segment] ?? "Details",
    href: `/${segments.slice(0, index + 1).join("/")}`,
  }));
}
