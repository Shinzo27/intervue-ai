import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InterviewSessionStatus,
  Application,
  Candidate,
  JobPosting,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createInterview(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: {
        id: applicationId,
      },
      include: {
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
      throw new NotFoundException('Application not found');
    }

    if (!application.jobPosting) {
      throw new BadRequestException(
        'Application is not associated with a job posting',
      );
    }

    if (!application.jobPosting.pipelineVersion) {
      throw new BadRequestException(
        'Job posting does not have a published pipeline snapshot',
      );
    }

    const existingInterview = await this.prisma.interviewSession.findUnique({
      where: {
        applicationId,
      },
    });

    if (existingInterview) {
      throw new BadRequestException(
        'An interview already exists for this application',
      );
    }

    const stages = application.jobPosting.pipelineVersion.stages;

    if (stages.length === 0) {
      throw new BadRequestException('Pipeline snapshot has no stages');
    }

    return this.prisma.$transaction(async (tx) => {
      const interview = await tx.interviewSession.create({
        data: {
          applicationId,
          status: InterviewSessionStatus.NOT_STARTED,
        },
      });

      const interviewStages = await tx.interviewStage.createManyAndReturn({
        data: stages.map((stage) => ({
          interviewSessionId: interview.id,
          pipelineStageVersionId: stage.id,
          order: stage.order,
        })),
      });

      interviewStages.sort((a, b) => a.order - b.order);

      const firstStage = interviewStages[0];

      await tx.interviewSession.update({
        where: {
          id: interview.id,
        },
        data: {
          currentStageId: firstStage.id,
        },
      });

      const result = await tx.interviewSession.findUnique({
        where: {
          id: interview.id,
        },
        include: {
          stages: {
            orderBy: {
              order: 'asc',
            },
          },
          currentStage: true,
        },
      });

      return result;
    });
  }

  async accessInterview(token: string) {
    const application = await this.prisma.application.findFirst({
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
      throw new NotFoundException('Invalid interview access token');
    }

    if (!application.candidate) {
      throw new BadRequestException('Candidate information is missing');
    }

    if (!application.jobPosting?.pipelineVersion) {
      throw new BadRequestException('Interview configuration is unavailable');
    }

    const interview = await this.prisma.interviewSession.findUnique({
      where: {
        applicationId: application.id,
      },
      include: {
        currentStage: true,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview session has not been created');
    }

    return {
      interviewId: interview.id,
      candidate: {
        name: [application.candidate.firstName, application.candidate.lastName]
          .filter(Boolean)
          .join(' '),
      },
      job: {
        title: application.jobPosting.title,
      },
      status: interview.status,
      currentStage: interview.currentStage
        ? {
            id: interview.currentStage.id,
            order: interview.currentStage.order,
            status: interview.currentStage.status,
          }
        : null,
    };
  }

  async startInterview(interviewId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: {
        id: interviewId,
      },
      include: {
        application: true,
        currentStage: true,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    if (interview.status !== InterviewSessionStatus.NOT_STARTED) {
      throw new BadRequestException(
        `Interview cannot be started from ${interview.status} status`,
      );
    }

    if (!interview.currentStage) {
      throw new BadRequestException('Interview does not have a current stage');
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.interviewSession.update({
        where: {
          id: interview.id,
        },
        data: {
          status: InterviewSessionStatus.IN_PROGRESS,
          startedAt: now,
        },
      });

      await tx.interviewStage.update({
        where: {
          id: interview.currentStage!.id,
        },
        data: {
          status: 'IN_PROGRESS',
          startedAt: now,
        },
      });

      await tx.application.update({
        where: {
          id: interview.applicationId,
        },
        data: {
          status: 'STARTED',
          startedAt: now,
        },
      });

      return tx.interviewSession.findUnique({
        where: {
          id: interview.id,
        },
        include: {
          application: true,
          stages: {
            orderBy: {
              order: 'asc',
            },
          },
          currentStage: true,
        },
      });
    });
  }

  async getCurrentInterview(interviewId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: {
        id: interviewId,
      },
      include: {
        application: {
          include: {
            candidate: true,
            jobPosting: true,
          },
        },
        currentStage: {
          include: {
            pipelineStageVersion: {
              include: {
                questions: {
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

    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    if (!interview.currentStage) {
      throw new BadRequestException('Interview does not have a current stage');
    }

    const { application, currentStage } = interview;
    const typedApplication = application as Application & {
      candidate: Candidate;
      jobPosting: JobPosting;
    };
    const { candidate, jobPosting } = typedApplication;

    return {
      interviewId: interview.id,

      status: interview.status,

      candidate: {
        id: candidate.id,
        name: [candidate.firstName, candidate.lastName]
          .filter((val): val is string => !!val)
          .join(' '),
      },

      job: {
        id: jobPosting.id,
        title: jobPosting.title,
      },

      stage: {
        id: currentStage.id,
        order: currentStage.order,
        status: currentStage.status,

        pipelineStageVersionId: interview.currentStage.pipelineStageVersionId,

        name: interview.currentStage.pipelineStageVersion.name,

        questions: interview.currentStage.pipelineStageVersion.questions.map(
          (question) => ({
            id: question.id,
            question: question.question,
            type: question.type,
            order: question.order,
            required: question.required,
          }),
        ),
      },
    };
  }

  async submitAnswer(interviewId: string, dto: SubmitAnswerDto) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: {
        id: interviewId,
      },
      include: {
        currentStage: {
          include: {
            pipelineStageVersion: {
              include: {
                questions: true,
              },
            },
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    if (interview.status !== InterviewSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Interview is not in progress');
    }

    if (!interview.currentStage) {
      throw new BadRequestException('Interview does not have a current stage');
    }

    const question = await this.prisma.questionVersion.findUnique({
      where: {
        id: dto.questionId,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const belongsToCurrentStage =
      question.pipelineStageVersionId ===
      interview.currentStage.pipelineStageVersionId;

    if (!belongsToCurrentStage) {
      throw new BadRequestException(
        'Question does not belong to the current interview stage',
      );
    }

    const existingAnswer = await this.prisma.answer.findFirst({
      where: {
        interviewSessionId: interviewId,
        questionVersionId: dto.questionId,
      },
    });

    if (existingAnswer) {
      throw new BadRequestException('Question has already been answered');
    }

    return this.prisma.answer.create({
      data: {
        interviewSessionId: interviewId,
        interviewStageId: interview.currentStage.id,
        questionVersionId: dto.questionId,
        type: 'TEXT',
        content: dto.content,
      },
    });
  }

  async evaluateAnswer(interviewId: string, answerId: string) {
    const answer = await this.prisma.answer.findFirst({
      where: {
        id: answerId,
        interviewSessionId: interviewId,
      },
      include: {
        questionVersion: {
          include: {
            rubricCriteria: true,
          },
        },
      },
    });

    if (!answer) {
      throw new NotFoundException('Answer not found');
    }

    const existingEvaluation = await this.prisma.aIEvaluation.findFirst({
      where: {
        answerId,
      },
    });

    if (existingEvaluation) {
      throw new BadRequestException('Answer has already been evaluated');
    }

    const evaluation = await this.prisma.aIEvaluation.create({
      data: {
        answerId: answer.id,
        interviewSessionId: interviewId,
        status: 'PENDING',
      },
    });

    return {
      evaluationId: evaluation.id,
      answerId: answer.id,
      status: evaluation.status,
      question: answer.questionVersion.question,
      answer: answer.content,
      rubricCriteria: answer.questionVersion.rubricCriteria,
    };
  }
}
