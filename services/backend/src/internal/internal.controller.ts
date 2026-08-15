import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InternalServiceGuard } from './guards/internal-service.guard';

@Controller('internal')
@UseGuards(InternalServiceGuard)
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('candidate/validate')
  async validateCandidate(@Body() body: { token: string }) {
    if (!body.token) {
      throw new UnauthorizedException('Candidate token is required');
    }

    const application = await this.prisma.application.findUnique({
      where: {
        inviteToken: body.token,
      },
      include: {
        candidate: true,
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

    return {
      applicationId: application.id,
      candidateId: application.candidateId,
      organizationId: application.organizationId,
      jobPostingId: application.jobPostingId,
      status: application.status,
      tokenExpiresAt: application.tokenExpiresAt,
      currentStageVersionId: application.currentStageVersionId,
      currentQuestionVersionId: application.currentQuestionVersionId,
    };
  }
}
