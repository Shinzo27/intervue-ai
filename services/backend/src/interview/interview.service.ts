import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InterviewService {
  constructor(private readonly prisma: PrismaService) {}

  async createForApplication(organizationId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        organizationId,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  // The legacy `getByToken` read lived here and returned the raw application
  // record — full candidate PII plus every question's rubric criteria — to
  // anyone holding an invite token, with no expiry check. Candidate access is
  // served by `CandidateInterviewController` (`/interviews/access/:token`),
  // which returns a curated shape behind `CandidateTokenGuard`.
}
