/**
 * CJS shim for every `better-auth/<subpath>` import used by the backend
 * (node, adapters/prisma, plugins, plugins/access,
 * plugins/organization/access). ESM-only in the real package — see
 * index.mock.ts for context.
 */

/** better-auth/node */
export function fromNodeHeaders(headers: unknown) {
  return headers;
}

/** better-auth/adapters/prisma */
export function prismaAdapter(_client: unknown, _options?: unknown) {
  return { id: 'prisma-adapter-shim' };
}

/** better-auth/plugins */
export function organization(_options?: unknown) {
  return { id: 'organization-plugin-shim' };
}

/** better-auth/plugins/access */
export function createAccessControl(_statements: unknown) {
  return {
    newRole: (statements: unknown) => ({ statements }),
  };
}

/** better-auth/plugins/organization/access */
export const defaultStatements = {
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  team: ['create', 'update', 'delete'],
  ac: ['create', 'read', 'update', 'delete'],
};
