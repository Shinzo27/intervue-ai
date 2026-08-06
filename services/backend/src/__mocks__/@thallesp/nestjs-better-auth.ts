import { SetMetadata } from '@nestjs/common';

export const AllowAnonymous = () => SetMetadata('PUBLIC', true);
export const Public = AllowAnonymous;
export const OptionalAuth = () => SetMetadata('OPTIONAL_AUTH', true);
export const RequireActiveOrg = () => SetMetadata('REQUIRE_ACTIVE_ORG', true);
export const Roles = () => SetMetadata('ROLES', true);
export const OrgRoles = () => SetMetadata('ORG_ROLES', true);
export const UserHasPermission = () => SetMetadata('USER_HAS_PERMISSION', true);
export const MemberHasPermission = () =>
  SetMetadata('MEMBER_HAS_PERMISSION', true);
export const Session = () => () => {};
export const AuthGuard = class {};
export const AuthModule = {
  forRoot: () => ({ module: class {} }),
  forRootAsync: () => ({ module: class {} }),
};
export const AuthService = class {};
