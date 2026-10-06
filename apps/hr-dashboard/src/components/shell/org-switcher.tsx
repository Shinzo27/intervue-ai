"use client";

import { useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";

interface Org {
  id: string;
  name: string;
  slug?: string | null;
}

/**
 * Organization switcher — Better Auth organization plugin.
 * Every backend query is scoped to the active organization, so this is the
 * tenant boundary for the whole dashboard.
 */
export function OrgSwitcher() {
  const { data: session } = useSession();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [busy, setBusy] = useState(false);

  const activeId =
    (session?.session as { activeOrganizationId?: string | null } | undefined)
      ?.activeOrganizationId ?? null;

  useEffect(() => {
    (async () => {
      const { data } = await authClient.organization.list();
      if (Array.isArray(data)) setOrgs(data as Org[]);
    })();
  }, [session?.session]);

  async function activate(id: string) {
    setBusy(true);
    await authClient.organization.setActive({ organizationId: id });
    setBusy(false);
    window.location.reload();
  }

  const active = orgs.find((o) => o.id === activeId);

  return (
    <div className="flex items-center gap-2">
      <span className="chip">org</span>
      <select
        className="panel-2 px-2 py-1 text-xs"
        value={activeId ?? ""}
        disabled={busy}
        onChange={(e) => activate(e.target.value)}
      >
        <option value="" disabled>
          {orgs.length ? "select organization…" : "no organizations"}
        </option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {!active && orgs.length > 0 && (
        <span className="text-[11px] text-[var(--warn)]">pick one to load data</span>
      )}
    </div>
  );
}
