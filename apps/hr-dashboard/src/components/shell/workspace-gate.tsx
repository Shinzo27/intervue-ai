"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Spinner } from "@repo/ui/spinner";
import { authClient, useSession } from "@/lib/auth-client";

function FullScreenSpinner({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <span className="flex items-center gap-2 text-sm text-muted-fg">
        <Spinner /> {label}
      </span>
    </div>
  );
}

/**
 * Guards the console: signed out → /sign-in, no organization → /onboarding,
 * organizations but none active → activate the first one.
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending, refetch } = useSession();

  const userId = session?.user?.id;
  const activeOrgId = (session?.session as { activeOrganizationId?: string | null } | undefined)
    ?.activeOrganizationId;

  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname ?? "/dashboard")}`);
      return;
    }
    if (activeOrgId) return;
    let cancelled = false;
    (async () => {
      const { data } = await authClient.organization.list();
      if (cancelled) return;
      const orgs = Array.isArray(data) ? data : [];
      if (orgs.length === 0) {
        router.replace("/onboarding");
        return;
      }
      await authClient.organization.setActive({ organizationId: orgs[0]!.id });
      await refetch();
    })();
    return () => {
      cancelled = true;
    };
  }, [isPending, userId, activeOrgId, pathname, router, refetch]);

  if (isPending || !userId) return <FullScreenSpinner label="Loading your workspace…" />;
  if (!activeOrgId) return <FullScreenSpinner label="Opening your organization…" />;
  return <>{children}</>;
}
