/**
 * CJS shim for `better-auth` in Jest e2e runs.
 *
 * better-auth 1.6.x ships ESM-only (.mjs), which Jest cannot require. The
 * internal e2e never exercises session-authenticated paths (it uses the
 * service token), so the auth instance only needs to exist structurally.
 */
export function betterAuth(_config: unknown) {
  return {
    api: {
      getSession: async () => null,
      getActiveMember: async () => null,
    },
    handler: async () => new Response(null, { status: 204 }),
  };
}

export default { betterAuth };
