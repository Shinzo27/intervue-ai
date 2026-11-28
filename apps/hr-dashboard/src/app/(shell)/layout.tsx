import type { ReactNode } from "react";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { WorkspaceGate } from "@/components/shell/workspace-gate";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceGate>
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceGate>
  );
}
