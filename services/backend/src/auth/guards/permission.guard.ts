import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../enums/permission.enum';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLE_PERMISSIONS } from '../../config/role-permission';
import { auth } from '../auth';
import { fromNodeHeaders } from 'better-auth/node';

import { Request } from 'express';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new ForbiddenException('User not authenticated');
    }

    const activeOrganizationId = session.session.activeOrganizationId;

    if (!activeOrganizationId) {
      throw new ForbiddenException('No active organization');
    }

    const member = await auth.api.getActiveMember({
      headers: fromNodeHeaders(request.headers),
    });

    if (!member) {
      throw new ForbiddenException(
        'User is not a member of the active organization',
      );
    }

    const role = member.role;

    const userPermissions = ROLE_PERMISSIONS[role];

    if (!userPermissions) {
      throw new ForbiddenException('Invalid user role');
    }

    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
