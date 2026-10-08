import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import express from 'express';
import { AuditService } from './audit.service';
import { getAuthContext } from '../auth/utils/session';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';

/**
 * Recruiter-facing audit history. Requires `audit:view` and is always scoped
 * to the caller's active organization — the browser never supplies an
 * organization id.
 */
@Controller('audit')
@UseGuards(PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_VIEW)
  async list(
    @Req() request: express.Request,
    @Query('limit') limit?: string,
    @Query('actorType') actorType?: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.auditService.list(organizationId, {
      limit: limit ? Number(limit) : undefined,
      actorType,
    });
  }
}
