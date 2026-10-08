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
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { OverrideDecisionDto } from './dto/override-decision.dto';
@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private calculateMockScore(content: string): number {
    const length = content.trim().length;

    if (length >= 300) {
      return 90;
    }

    if (length >= 150) {
      return 80;
    }

    if (length >= 75) {
      return 70;
    }

    if (length > 0) {
      return 50;
    }

    return 0;
  }

  private calculateCriterionScore(content: string, maxScore: number): number {
    const length = content.trim().length;

    if (length >= 300) {
      return maxScore;
    }

    if (length >= 150) {
      return Math.floor(maxScore * 0.8);
    }

    if (length >= 75) {
      return Math.floor(maxScore * 0.7);
    }

    if (length > 0) {
      return Math.floor(maxScore * 0.5);
    }

    return 0;
  }

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
        currentStage: true,
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

    if (
      question.pipelineStageVersionId !==
      interview.currentStage.pipelineStageVersionId
    ) {
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

    return this.prisma.$transaction(async (tx) => {
      // 1. Save answer
      const answer = await tx.answer.create({
        data: {
          interviewSessionId: interviewId,
          interviewStageId: interview.currentStage!.id,
          questionVersionId: dto.questionId,
          type: 'TEXT',
          content: dto.content,
        },
      });

      // 2. Find next question in current stage
      const nextQuestion = await tx.questionVersion.findFirst({
        where: {
          pipelineStageVersionId:
            interview.currentStage!.pipelineStageVersionId,
          order: {
            gt: question.order,
          },
        },
        orderBy: {
          order: 'asc',
        },
      });

      // 3. More questions remain in this stage
      if (nextQuestion) {
        await tx.application.update({
          where: {
            id: interview.applicationId,
          },
          data: {
            currentQuestionVersionId: nextQuestion.id,
          },
        });

        return {
          answer,
          nextQuestion,
          stageCompleted: false,
          interviewCompleted: false,
        };
      }

      // 4. Current stage is complete
      await tx.interviewStage.update({
        where: {
          id: interview.currentStage!.id,
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // 5. Find next interview stage
      const nextStage = await tx.interviewStage.findFirst({
        where: {
          interviewSessionId: interviewId,
          order: {
            gt: interview.currentStage!.order,
          },
        },
        orderBy: {
          order: 'asc',
        },
      });

      // 6. More stages remain
      if (nextStage) {
        await tx.interviewStage.update({
          where: {
            id: nextStage.id,
          },
          data: {
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          },
        });

        const firstQuestion = await tx.questionVersion.findFirst({
          where: {
            pipelineStageVersionId: nextStage.pipelineStageVersionId,
          },
          orderBy: {
            order: 'asc',
          },
        });

        if (!firstQuestion) {
          throw new BadRequestException('Next stage has no questions');
        }

        await tx.interviewSession.update({
          where: {
            id: interviewId,
          },
          data: {
            currentStageId: nextStage.id,
          },
        });

        await tx.application.update({
          where: {
            id: interview.applicationId,
          },
          data: {
            currentStageVersionId: nextStage.pipelineStageVersionId,
            currentQuestionVersionId: firstQuestion.id,
          },
        });

        return {
          answer,
          nextQuestion: firstQuestion,
          stageCompleted: true,
          interviewCompleted: false,
        };
      }

      // 7. No stages remain — interview is complete
      await tx.interviewSession.update({
        where: {
          id: interviewId,
        },
        data: {
          status: InterviewSessionStatus.COMPLETED,
          completedAt: new Date(),
          currentStageId: null,
        },
      });

      await tx.application.update({
        where: {
          id: interview.applicationId,
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          currentStageVersionId: null,
          currentQuestionVersionId: null,
        },
      });

      return {
        answer,
        nextQuestion: null,
        stageCompleted: true,
        interviewCompleted: true,
      };
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
        interviewSession: true,
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

    const criteria = answer.questionVersion.rubricCriteria;

    if (criteria.length === 0) {
      throw new BadRequestException('Question has no rubric criteria');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create evaluation
      const evaluation = await tx.aIEvaluation.create({
        data: {
          answerId: answer.id,
          interviewSessionId: interviewId,
          status: 'PENDING',
          model: 'mock-evaluator-v1',
        },
      });

      // 2. Calculate criterion scores
      const criterionResults = criteria.map((criterion) => {
        const score = Math.min(
          criterion.maxScore,
          this.calculateCriterionScore(answer.content, criterion.maxScore),
        );

        return {
          criterionId: criterion.id,
          score,
          maxScore: criterion.maxScore,
          reasoning:
            score >= criterion.maxScore * 0.7
              ? `The answer demonstrates reasonable understanding of ${criterion.name}.`
              : `The answer demonstrates limited understanding of ${criterion.name}.`,
        };
      });

      // 3. Calculate overall score
      const overallScore = criterionResults.reduce(
        (total, criterion) => total + criterion.score,
        0,
      );

      const maxScore = criterionResults.reduce(
        (total, criterion) => total + criterion.maxScore,
        0,
      );

      const reasoning =
        overallScore >= maxScore * 0.7
          ? 'The candidate demonstrated a satisfactory understanding across the evaluated criteria.'
          : 'The candidate demonstrated limited understanding across the evaluated criteria.';

      // 4. Create Score
      const scoreRecord = await tx.score.create({
        data: {
          applicationId: answer.interviewSession.applicationId,
          questionVersionId: answer.questionVersionId,
          overallScore,
          maxScore,
          reasoning,
        },
      });

      // 5. Create CriterionScore records
      await tx.criterionScore.createMany({
        data: criterionResults.map((criterion) => ({
          scoreId: scoreRecord.id,
          rubricCriterionVersionId: criterion.criterionId,
          score: criterion.score,
          reasoning: criterion.reasoning,
        })),
      });

      // 6. Complete AI evaluation
      const completedEvaluation = await tx.aIEvaluation.update({
        where: {
          id: evaluation.id,
        },
        data: {
          status: 'COMPLETED',
          score: overallScore,
          reasoning,
          result: {
            overallScore,
            maxScore,
            criteria: criterionResults,
          },
        },
      });

      return {
        evaluation: completedEvaluation,
        score: {
          id: scoreRecord.id,
          overallScore,
          maxScore,
          reasoning,
          criteria: criterionResults,
        },
      };
    });
  }

  async createConversation(interviewId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: {
        id: interviewId,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    const existingConversation = await this.prisma.conversation.findUnique({
      where: {
        interviewSessionId: interviewId,
      },
    });

    if (existingConversation) {
      return existingConversation;
    }

    return this.prisma.conversation.create({
      data: {
        interviewSessionId: interviewId,
      },
    });
  }

  async createMessage(interviewId: string, dto: CreateMessageDto) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: {
        id: interviewId,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: {
        interviewSessionId: interviewId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation has not been created');
    }

    return this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: dto.role,
        content: dto.content,
      },
    });
  }

  /**
   * Candidate-safe transcript behind the invite token: the conversation as
   * the candidate experienced it (role + text + time). Message metadata is
   * internal (model names, fallback flags) and is deliberately not exposed.
   * An interview with no conversation yet returns an empty list, so a fresh
   * candidate resumes cleanly rather than getting a 404.
   */
  async getCandidateTranscript(interviewId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
      select: { id: true, status: true },
    });

    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { interviewSessionId: interviewId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });

    // Progress is part of the resume payload: after a refresh the candidate
    // should see the same progress bar they had before, not an empty one.
    const [stages, answeredQuestions] = await Promise.all([
      this.prisma.interviewStage.findMany({
        where: { interviewSessionId: interviewId },
        select: {
          status: true,
          pipelineStageVersion: { select: { _count: { select: { questions: true } } } },
        },
      }),
      this.prisma.answer.count({ where: { interviewSessionId: interviewId } }),
    ]);

    return {
      interviewId: interview.id,
      status: interview.status,
      messages: conversation?.messages ?? [],
      progress: {
        totalStages: stages.length,
        completedStages: stages.filter((s) => s.status === 'COMPLETED').length,
        totalQuestions: stages.reduce(
          (total, s) => total + s.pipelineStageVersion._count.questions,
          0,
        ),
        answeredQuestions,
      },
    };
  }

  async getConversation(interviewId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: {
        id: interviewId,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: {
        interviewSessionId: interviewId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation has not been created');
    }

    return conversation;
  }

  async createDecision(
    interviewId: string,
    dto: CreateDecisionDto,
    organizationId?: string,
  ) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: {
        id: interviewId,
      },
      include: {
        application: true,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    // Tenant boundary: callers act only inside their active organization.
    // Absent an explicit org (internal service-to-service calls) the check is
    // skipped, so this cannot break the AI capability layer.
    if (
      organizationId &&
      interview.application.organizationId !== organizationId
    ) {
      throw new NotFoundException('Interview session not found');
    }

    const existingDecision = await this.prisma.decision.findUnique({
      where: {
        applicationId: interview.applicationId,
      },
    });

    if (existingDecision) {
      throw new BadRequestException(
        'A decision already exists for this application',
      );
    }

    const scores = await this.prisma.score.findMany({
      where: {
        applicationId: interview.applicationId,
      },
    });

    if (scores.length === 0) {
      throw new BadRequestException('No scores available for this application');
    }

    const totalScore = scores.reduce(
      (total, score) => total + score.overallScore,
      0,
    );

    const maxScore = scores.reduce((total, score) => total + score.maxScore, 0);

    return this.prisma.decision.create({
      data: {
        applicationId: interview.applicationId,
        outcome: dto.outcome,
        totalScore,
        maxScore,
        reasoning: `Decision created from ${scores.length} evaluated question(s).`,
      },
    });
  }

  async overrideDecision(
    interviewId: string,
    userId: string,
    dto: OverrideDecisionDto,
    organizationId?: string,
  ) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: {
        id: interviewId,
      },
      include: {
        application: true,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    // Tenant boundary (§44/§64): a recruiter may only override decisions that
    // belong to their own organization. Reported as 404 rather than 403 so the
    // endpoint does not confirm the existence of another tenant's interview.
    if (
      organizationId &&
      interview.application.organizationId !== organizationId
    ) {
      throw new NotFoundException('Interview session not found');
    }

    const decision = await this.prisma.decision.findUnique({
      where: {
        applicationId: interview.applicationId,
      },
    });

    if (!decision) {
      throw new NotFoundException('Decision not found for this application');
    }

    if (decision.outcome === dto.newOutcome) {
      throw new BadRequestException(
        'New outcome must be different from the current outcome',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const override = await tx.decisionOverride.create({
        data: {
          decisionId: decision.id,
          overriddenById: userId,
          previousOutcome: decision.outcome,
          newOutcome: dto.newOutcome,
          reason: dto.reason,
        },
      });

      const updatedDecision = await tx.decision.update({
        where: {
          id: decision.id,
        },
        data: {
          outcome: dto.newOutcome,
          decidedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: interview.application.organizationId,
          actorType: 'USER',
          actorId: userId,
          action: 'DECISION_OVERRIDDEN',
          entityType: 'Decision',
          entityId: decision.id,
          metadata: {
            previousOutcome: decision.outcome,
            newOutcome: dto.newOutcome,
            reason: dto.reason,
            decisionOverrideId: override.id,
          },
        },
      });

      return {
        decision: updatedDecision,
        override,
      };
    });
  }
}
