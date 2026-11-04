import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/** Request enriched by the guard with the token's interview context. */
export interface CandidateRequest extends Request {
  candidateInterview?: {
    applicationId: string;
    interviewId: string;
    /**
     * The token's own organization. Service methods require an org to scope
     * their lookup; the candidate path passes the one the token resolved, so
     * the tenant boundary holds without trusting anything the caller sends.
     */
    organizationId: string;
    candidateName: string;
    jobTitle: string;
  };
}

/**
 * Candidate token guard — the capability model for account-less candidates
 * (master-note §15, §49).
 *
 * The invite token *is* the credential: it resolves to exactly one
 * application, so a candidate can only ever reach their own interview — there
 * is no interview id to guess or tamper with. Links are enforced against
 * `tokenExpiresAt` here, which is the only place expiry can be trusted.
 *
 * `@Public()` on the controller opts out of the session guard; this guard is
 * what actually authorizes the request.
 */
@Injectable()
export class CandidateTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CandidateRequest>();
    const raw = request.params?.token;
    const token = Array.isArray(raw) ? raw[0] : raw;

    if (!token) {
      throw new UnauthorizedException('Interview token required');
    }

    const application = await this.prisma.application.findFirst({
      where: { inviteToken: token },
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        jobPosting: { select: { title: true } },
        interviewSession: { select: { id: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Invalid interview access token');
    }

    if (
      application.tokenExpiresAt &&
      application.tokenExpiresAt.getTime() < Date.now()
    ) {
      throw new ForbiddenException('This interview link has expired');
    }

    if (!application.interviewSession) {
      throw new NotFoundException('Interview session has not been created');
    }

    request.candidateInterview = {
      applicationId: application.id,
      interviewId: application.interviewSession.id,
      organizationId: application.organizationId,
      candidateName: [
        application.candidate?.firstName,
        application.candidate?.lastName,
      ]
        .filter(Boolean)
        .join(' '),
      jobTitle: application.jobPosting?.title ?? '',
    };

    return true;
  }
}
