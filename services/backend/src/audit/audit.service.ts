import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Recruiter-facing audit trail (master-note §28, §57).
 *
 * Read-only and always organization-scoped: an organization can see exactly
 * its own events, including which actor produced them (USER / AI / SYSTEM).
 * The internal service API has its own audit route; this one exists so the
 * dashboard never needs the service token.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    options: { limit?: number; actorType?: string } = {},
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
    const actorType = options.actorType?.toUpperCase();

    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(actorType ? { actorType: actorType as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
