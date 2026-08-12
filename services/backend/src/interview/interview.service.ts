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

  async getByToken(inviteToken: string) {
    const application = await this.prisma.application.findUnique({
      where: {
        inviteToken,
      },
      include: {
        candidate: true,
        jobPosting: {
          include: {
            pipelineVersion: {
              include: {
                stages: {
                  include: {
                    questions: {
                      include: {
                        options: true,
                        rubricCriteria: true,
                      },
                      orderBy: {
                        order: 'asc',
                      },
                    },
                  },
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
      throw new NotFoundException('Invalid interview link');
    }

    return application;
  }
}
