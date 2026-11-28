"use client";

import { LogOut } from "lucide-react";
import { Avatar } from "@repo/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { authClient, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const { data: session } = useSession();
  const user = session?.user;
  if (!user) return null;
  const name = user.name || user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${name}`}
        className="rounded-full transition-shadow hover:ring-2 hover:ring-border-strong"
      >
        <Avatar name={name} src={user.image} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 text-fg">
          <span className="truncate text-sm font-semibold">{user.name || "Signed in"}</span>
          <span className="truncate text-xs font-normal text-muted-fg">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await authClient.signOut();
            window.location.assign("/");
          }}
        >
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
