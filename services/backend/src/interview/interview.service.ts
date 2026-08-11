import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
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

    const existingInterview = await this.prisma.interview.findUnique({
      where: {
        applicationId,
      },
    });

    if (existingInterview) {
      return existingInterview;
    }

    const accessToken = randomBytes(32).toString('hex');

    return this.prisma.interview.create({
      data: {
        applicationId,
        accessToken,
      },
    });
  }

  async getByToken(accessToken: string) {
    const interview = await this.prisma.interview.findUnique({
      where: {
        accessToken,
      },
      include: {
        application: {
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
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Invalid interview link');
    }

    return interview;
  }
}
