"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronsUpDown } from "lucide-react";
import { Badge } from "@repo/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Spinner } from "@repo/ui/spinner";
import { authClient, useSession } from "@/lib/auth-client";

interface Org {
  id: string;
  name: string;
}

/**
 * Organization switcher (Better Auth organization plugin). Every backend
 * query is scoped to the active organization: this is the tenant boundary.
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
    if (id === activeId) return;
    setBusy(true);
    await authClient.organization.setActive({ organizationId: id });
    window.location.reload();
  }

  const active = orgs.find((org) => org.id === activeId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 min-w-0 max-w-56 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-fg shadow-sm transition-colors hover:bg-surface-hover"
        aria-label={active ? `Organization: ${active.name}. Switch organization` : "Choose organization"}
      >
        <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-primary-subtle text-primary">
          {busy ? <Spinner className="size-3" /> : <Building2 className="size-3.5" aria-hidden />}
        </span>
        <span className="truncate">{active?.name ?? "Choose organization"}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-fg" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {orgs.length === 0 ? (
          <p className="px-2 pb-2 text-sm text-muted-fg">You don&apos;t belong to an organization yet.</p>
        ) : (
          <DropdownMenuRadioGroup value={activeId ?? ""} onValueChange={activate}>
            {orgs.map((org) => (
              <DropdownMenuRadioItem key={org.id} value={org.id}>
                <span className="truncate">{org.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
      {!active && orgs.length > 0 && (
        <Badge variant="warning" className="hidden sm:inline-flex">
          Pick one to load data
        </Badge>
      )}
    </DropdownMenu>
  );
}
