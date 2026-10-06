"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { API_URL } from "./api";

/**
 * Better Auth browser client (session cookies + organization plugin).
 * The org plugin is required for organization.list / setActive — the tenant
 * boundary of the whole dashboard.
 */
export const authClient = createAuthClient({
  baseURL: `${API_URL}/auth`,
  plugins: [organizationClient()],
});

export const { useSession, signIn, signOut } = authClient;
