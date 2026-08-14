import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ApplicationWithRelations = Prisma.ApplicationGetPayload<{
  include: {
    candidate: true;
    jobPosting: {
      include: {
        pipelineVersion: {
          include: {
            stages: true;
          };
        };
      };
    };
  };
}>;

export interface CandidateAuthRequest extends Request {
  candidateAuth?: {
    applicationId: string;
    candidateId: string;
    organizationId: string;
    jobPostingId: string;
    application: ApplicationWithRelations;
  };
}

@Injectable()
export class CandidateTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CandidateAuthRequest>();

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Candidate token is required');
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid candidate authorization');
    }

    const application = await this.prisma.application.findUnique({
      where: {
        inviteToken: token,
      },
      include: {
        candidate: true,

        jobPosting: {
          include: {
            pipelineVersion: {
              include: {
                stages: {
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!application) {
      throw new UnauthorizedException('Invalid candidate token');
    }

    if (application.tokenExpiresAt <= new Date()) {
      throw new UnauthorizedException('Candidate token has expired');
    }

    if (
      application.status === 'COMPLETED' ||
      application.status === 'DECIDED'
    ) {
      throw new UnauthorizedException(
        'Candidate application is no longer active',
      );
    }

    request.candidateAuth = {
      applicationId: application.id,
      candidateId: application.candidateId,
      organizationId: application.organizationId,
      jobPostingId: application.jobPostingId,
      application,
    };

    return true;
  }
}
