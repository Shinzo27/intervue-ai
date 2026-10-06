import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateApplicationDto } from './dto/create-application.dto';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InviteCandidateDto } from './dto/invite-candidate.dto';
import { CandidateInvitationQueue } from '../queue/candidate-invitation.queue';

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidateInvitationQueue: CandidateInvitationQueue,
  ) {}

  async create(organizationId: string, dto: CreateApplicationDto) {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: dto.candidateId,
        organizationId,
      },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    const jobPosting = await this.prisma.jobPosting.findFirst({
      where: {
        id: dto.jobPostingId,
        organizationId,
      },
    });

    if (!jobPosting) {
      throw new NotFoundException('Job posting not found');
    }

    const existingApplication = await this.prisma.application.findUnique({
      where: {
        candidateId: dto.candidateId,
      },
    });

    if (existingApplication) {
      throw new BadRequestException(
        'Candidate has already applied to this job',
      );
    }

    const inviteToken = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return this.prisma.application.create({
      data: {
        organizationId,
        candidateId: dto.candidateId,
        jobPostingId: dto.jobPostingId,
        status: dto.status,
        inviteToken,
        tokenExpiresAt,
      },
      include: {
        candidate: true,
        jobPosting: true,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.application.findMany({
      where: {
        organizationId,
      },
      include: {
        candidate: true,
        jobPosting: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const application = await this.prisma.application.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        candidate: true,
        jobPosting: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  async inviteCandidate(organizationId: string, dto: InviteCandidateDto) {
    const jobPosting = await this.prisma.jobPosting.findFirst({
      where: {
        id: dto.jobPostingId,
        organizationId,
      },
      include: {
        pipelineVersion: true,
      },
    });

    if (!jobPosting) {
      throw new NotFoundException('Job posting not found');
    }

    if (jobPosting.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Candidate can only be invited to a published job',
      );
    }

    if (!jobPosting.pipelineVersionId || !jobPosting.pipelineVersion) {
      throw new BadRequestException(
        'Job posting does not have a published pipeline version',
      );
    }

    const existingApplication = await this.prisma.application.findFirst({
      where: {
        organizationId,
        jobPostingId: dto.jobPostingId,
        candidate: {
          email: dto.email,
        },
      },
    });

    if (existingApplication) {
      throw new BadRequestException(
        'Candidate has already been invited to this job',
      );
    }

    const inviteToken = randomBytes(32).toString('hex');

    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.create({
        data: {
          organizationId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
        },
      });

      const application = await tx.application.create({
        data: {
          organizationId,
          candidateId: candidate.id,
          jobPostingId: jobPosting.id,
          inviteToken,
          tokenExpiresAt,
          status: 'INVITED',
        },
        include: {
          candidate: true,
          jobPosting: true,
        },
      });

      return application;
    });

    await this.candidateInvitationQueue.addInvitationJob({
      applicationId: result.id,
      candidateEmail: result.candidate.email,
      candidateName: `${result.candidate.firstName} ${result.candidate.lastName}`,
      inviteToken: result.inviteToken,
    });

    return result;
  }

  /**
   * Application review aggregate — the recruiter-facing review screen:
   * frozen snapshot questions, candidate answers, per-question scores with
   * criterion breakdowns, every AI evaluation (two-model panel), the decision
   * and its human override history. Always organization-scoped.
   */
  async getReview(organizationId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, organizationId },
      include: {
        candidate: true,
        jobPosting: { select: { id: true, title: true, status: true } },
        interviewSession: {
          include: {
            stages: {
              orderBy: { order: 'asc' },
              include: {
                pipelineStageVersion: { select: { name: true, order: true } },
                answers: { orderBy: { submittedAt: 'asc' } },
              },
            },
            evaluations: { orderBy: { createdAt: 'asc' } },
            conversations: { select: { id: true }, take: 1 },
          },
        },
        scores: {
          include: {
            criterionScores: {
              include: {
                rubricCriterionVersion: { select: { name: true, maxScore: true } },
              },
            },
          },
        },
        decision: {
          include: {
            overrides: {
              orderBy: { createdAt: 'desc' },
              include: {
                overriddenBy: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const session = application.interviewSession;

    const scoreByQuestion = new Map(
      application.scores.map((s) => [s.questionVersionId, s]),
    );

    const answers = session
      ? await this.prisma.answer.findMany({
          where: { interviewSessionId: session.id },
          orderBy: { submittedAt: 'asc' },
        })
      : [];
    const answerByQuestion = new Map(
      answers.map((a) => [a.questionVersionId, a]),
    );

    const stageVersionIds = (session?.stages ?? []).map(
      (s) => s.pipelineStageVersionId,
    );

    // Question text lives on the frozen versions still attached to the
    // runtime stages — the same snapshot the candidate was interviewed on.
    const questions = stageVersionIds.length
      ? await this.prisma.questionVersion.findMany({
          where: { pipelineStageVersionId: { in: stageVersionIds } },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            question: true,
            type: true,
            pipelineStageVersionId: true,
          },
        })
      : [];

    const stages = (session?.stages ?? []).map((stage) => {
      const stageQuestions = questions.filter(
        (q) => q.pipelineStageVersionId === stage.pipelineStageVersionId,
      );
      return {
        id: stage.id,
        order: stage.order,
        status: stage.status,
        name: stage.pipelineStageVersion.name,
        questions: stageQuestions.map((q) => {
          const answer = answerByQuestion.get(q.id);
          const score = scoreByQuestion.get(q.id);
          return {
            questionVersionId: q.id,
            order: q.order,
            question: q.question,
            type: q.type,
            answer: answer
              ? {
                  id: answer.id,
                  type: answer.type,
                  content: answer.content,
                  submittedAt: answer.submittedAt,
                }
              : null,
            score: score
              ? {
                  overallScore: score.overallScore,
                  maxScore: score.maxScore,
                  reasoning: score.reasoning,
                  criteria: score.criterionScores.map((c) => ({
                    name: c.rubricCriterionVersion.name,
                    score: c.score,
                    maxScore: c.rubricCriterionVersion.maxScore,
                    reasoning: c.reasoning,
                  })),
                }
              : null,
          };
        }),
      };
    });

    const totalScore = application.scores.reduce((s, r) => s + r.overallScore, 0);
    const maxScore = application.scores.reduce((s, r) => s + r.maxScore, 0);

    return {
      application: {
        id: application.id,
        status: application.status,
        createdAt: application.createdAt,
        completedAt: application.completedAt,
        decidedAt: application.decidedAt,
      },
      candidate: application.candidate,
      jobPosting: application.jobPosting,
      interview: session
        ? {
            id: session.id,
            status: session.status,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
          }
        : null,
      stages,
      evaluations: (session?.evaluations ?? []).map((e) => ({
        id: e.id,
        answerId: e.answerId,
        model: e.model,
        status: e.status,
        score: e.score,
        reasoning: e.reasoning,
        result: e.result,
        createdAt: e.createdAt,
      })),
      decision: application.decision
        ? {
            outcome: application.decision.outcome,
            totalScore: application.decision.totalScore,
            maxScore: application.decision.maxScore,
            reasoning: application.decision.reasoning,
            decidedAt: application.decision.decidedAt,
            overrides: application.decision.overrides.map((o) => ({
              previousOutcome: o.previousOutcome,
              newOutcome: o.newOutcome,
              reason: o.reason,
              createdAt: o.createdAt,
              overriddenBy: o.overriddenBy,
            })),
          }
        : null,
      totals: {
        totalScore,
        maxScore,
        percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      },
    };
  }
}
