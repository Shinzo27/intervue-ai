import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { auth } from '../auth';
import { fromNodeHeaders } from 'better-auth/node';

export async function getAuthContext(request: Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    throw new ForbiddenException('User not authenticated');
  }

  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    throw new ForbiddenException('No active organization');
  }

  return {
    userId: session.user.id,
    organizationId,
  };
}
