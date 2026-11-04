/**
 * Guards the wiring that made `GET /applications/:id/review` open to every
 * member of an organization: `@RequirePermissions` was declared on the route
 * but the controller never ran `PermissionsGuard`, so the metadata was inert
 * and the guard's "no permissions required -> allow" branch never even ran.
 *
 * The auth modules are mocked because the real ones pull in better-auth's ESM
 * build, which this Jest project does not transform.
 */
jest.mock('../auth/guards/permission.guard', () => ({
  PermissionsGuard: class PermissionsGuard {},
}));

jest.mock('../auth/utils/session', () => ({
  getAuthContext: jest.fn(),
}));

import { ApplicationController } from './application.controller';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';

const GUARDS_METADATA = '__guards__';

describe('ApplicationController permission wiring', () => {
  it('runs PermissionsGuard so @RequirePermissions is actually enforced', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ApplicationController,
    ) as unknown[] | undefined;

    expect(guards ?? []).toContain(PermissionsGuard);
  });

  it('keeps interview:evaluate on the review route', () => {
    // Read the handler off the prototype descriptor: a bare method reference
    // is flagged as an unbound method, and it is the metadata we are after.
    const handler = (
      Object.getOwnPropertyDescriptor(
        ApplicationController.prototype,
        'getReview',
      ) as { value: object }
    ).value;

    const permissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      handler,
    ) as Permission[];

    expect(permissions).toEqual([Permission.INTERVIEW_EVALUATE]);
  });
});
