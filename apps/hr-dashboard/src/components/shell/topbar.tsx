"use client";

import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { OrgSwitcher } from "./org-switcher";

/**
 * Topbar: shows the active organization + signed-in user, with sign-out.
 * Organization switching uses Better Auth's organization plugin.
 */
export function Topbar() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5">
      <div className="flex items-center gap-3">
        <OrgSwitcher />
        <span className="muted text-xs">
          organization-scoped · every query is tenant-isolated server-side
        </span>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {isPending ? (
          <span className="muted text-xs">loading…</span>
        ) : session?.user ? (
          <>
            <span className="muted text-xs">{session.user.email}</span>
            <button
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-2)]"
              onClick={async () => {
                await authClient.signOut();
                router.refresh();
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <span className="muted text-xs">not signed in</span>
        )}
      </div>
    </header>
  );
}
