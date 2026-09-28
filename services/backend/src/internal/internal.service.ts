import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AIEvaluation,
  EvaluationStatus,
  InterviewSessionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InterviewsService } from '../interviews/interviews.service';
import { CreateInternalMessageDto } from './dto/create-internal-message.dto';
import { SubmitInternalAnswerDto } from './dto/submit-internal-answer.dto';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { CompleteEvaluationDto } from './dto/complete-evaluation.dto';
import { FailEvaluationDto } from './dto/fail-evaluation.dto';
import { UpsertScoreDto } from './dto/upsert-score.dto';
import { CreateInternalDecisionDto } from './dto/create-internal-decision.dto';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interviews: InterviewsService,
  ) {}

  // ------------------------------------------------------------------ reads

  /**
   * Full interview state for the AI agent: session, current stage version,
   * current question version (+ options + rubric criteria), progress
   * counters, and the application/candidate/job summary.
   *
   * This is the single most important read endpoint — it is what
   * `get_current_interview_state` (Pipeline MCP) resolves against.
   */
  async getInterviewState(interviewId: string) {
    if (!UUID_RE.test(interviewId)) {
      throw new BadRequestException('interviewId must be a UUID');
    }

    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
      include: {
        application: {
          include: { candidate: true, jobPosting: true },
        },
        currentStage: {
          include: {
            pipelineStageVersion: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  include: { options: true, rubricCriteria: true },
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

    const { application, currentStage } = interview;

    // Which questions in the current stage are still unanswered?
    const answeredQuestionIds = new Set(
      (
        await this.prisma.answer.findMany({
          where: { interviewSessionId: interview.id },
          select: { questionVersionId: true },
        })
      ).map((a) => a.questionVersionId),
    );

    const stageQuestions = currentStage
      ? currentStage.pipelineStageVersion.questions
      : [];
    const currentQuestion = stageQuestions.find(
      (q) => !answeredQuestionIds.has(q.id),
    );

    // Progress across the whole interview.
    const allStages = await this.prisma.interviewStage.findMany({
      where: { interviewSessionId: interview.id },
      orderBy: { order: 'asc' },
    });
    const stageVersionIds = allStages.map((s) => s.pipelineStageVersionId);
    const totalQuestionCount = stageVersionIds.length
      ? await this.prisma.questionVersion.count({
          where: { pipelineStageVersionId: { in: stageVersionIds } },
        })
      : 0;

    return {
      interview: {
        id: interview.id,
        status: interview.status,
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
      },
      application: {
        id: application.id,
        status: application.status,
        organizationId: application.organizationId,
      },
      candidate: {
        id: application.candidate.id,
        name: [application.candidate.firstName, application.candidate.lastName]
          .filter(Boolean)
          .join(' '),
        email: application.candidate.email,
      },
      job: {
        id: application.jobPosting.id,
        title: application.jobPosting.title,
      },
      stage: currentStage
        ? {
            id: currentStage.id,
            order: currentStage.order,
            status: currentStage.status,
            pipelineStageVersionId: currentStage.pipelineStageVersionId,
            name: currentStage.pipelineStageVersion.name,
            questionCount: stageQuestions.length,
          }
        : null,
      question: currentQuestion
        ? {
            id: currentQuestion.id,
            order: currentQuestion.order,
            type: currentQuestion.type,
            required: currentQuestion.required,
            question: currentQuestion.question,
            options: currentQuestion.options
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((o) => ({ id: o.id, text: o.text, order: o.order })),
            rubricCriteria: currentQuestion.rubricCriteria.map((c) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              maxScore: c.maxScore,
            })),
          }
        : null,
      progress: {
        totalStages: allStages.length,
        completedStages: allStages.filter((s) => s.status === 'COMPLETED')
          .length,
        totalQuestions: totalQuestionCount,
        answeredQuestions: answeredQuestionIds.size,
      },
    };
  }

  /**
   * The exact question the candidate must answer next (verbatim question
   * text + options). `get_current_question` (Pipeline MCP) resolves here.
   */
  async getCurrentQuestion(interviewId: string) {
    if (!UUID_RE.test(interviewId)) {
      throw new BadRequestException('interviewId must be a UUID');
    }

    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
      include: {
        currentStage: {
          include: {
            pipelineStageVersion: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  include: { options: true },
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

    const answeredQuestionIds = new Set(
      (
        await this.prisma.answer.findMany({
          where: { interviewSessionId: interview.id },
          select: { questionVersionId: true },
        })
      ).map((a) => a.questionVersionId),
    );

    const stageQuestions =
      interview.currentStage?.pipelineStageVersion.questions ?? [];
    const currentQuestion = stageQuestions.find(
      (q) => !answeredQuestionIds.has(q.id),
    );

    if (!currentQuestion) {
      throw new NotFoundException(
        interview.status === InterviewSessionStatus.COMPLETED
          ? 'Interview is completed; there is no current question'
          : 'No unanswered question in the current stage',
      );
    }

    return {
      interviewId: interview.id,
      interviewStatus: interview.status,
      stageId: interview.currentStage!.id,
      stageName: interview.currentStage!.pipelineStageVersion.name,
      question: {
        id: currentQuestion.id,
        order: currentQuestion.order,
        type: currentQuestion.type,
        required: currentQuestion.required,
        question: currentQuestion.question,
        options: currentQuestion.options
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((o) => ({ id: o.id, text: o.text, order: o.order })),
      },
    };
  }

  /**
   * All questions of a stage version, in order. The interviewId is the
   * ownership anchor: the stageVersionId must belong to one of the
   * interview's runtime stages — cross-interview reads are rejected.
   */
  async getStageQuestions(interviewId: string, stageVersionId: string) {
    if (!UUID_RE.test(interviewId)) {
      throw new BadRequestException('interviewId must be a UUID');
    }

    const stageVersion = await this.prisma.pipelineStageVersion.findUnique({
      where: { id: stageVersionId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: true },
        },
      },
    });

    if (!stageVersion) {
      throw new NotFoundException('Stage version not found');
    }

    // Ownership: the stage version must belong to this interview.
    const owned = await this.prisma.interviewStage.findFirst({
      where: {
        interviewSessionId: interviewId,
        pipelineStageVersionId: stageVersionId,
      },
      select: { id: true, order: true, status: true },
    });
    if (!owned) {
      throw new NotFoundException(
        'Stage version does not belong to this interview',
      );
    }

    return {
      interviewId,
      stage: {
        id: stageVersion.id,
        name: stageVersion.name,
        order: stageVersion.order,
      },
      runtimeStage: owned,
      questions: stageVersion.questions.map((q) => ({
        id: q.id,
        order: q.order,
        type: q.type,
        required: q.required,
        question: q.question,
        options: q.options
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((o) => ({ id: o.id, text: o.text, order: o.order })),
      })),
    };
  }

  /**
   * Question version details including rubric criteria — the scoring
   * context. Ownership enforced against the interview's snapshot.
   */
  async getQuestionDetails(interviewId: string, questionVersionId: string) {
    if (!UUID_RE.test(interviewId)) {
      throw new BadRequestException('interviewId must be a UUID');
    }

    const questionVersion = await this.prisma.questionVersion.findUnique({
      where: { id: questionVersionId },
      include: {
        options: true,
        rubricCriteria: true,
        pipelineStageVersion: true,
      },
    });

    if (!questionVersion) {
      throw new NotFoundException('Question version not found');
    }

    // Ownership: the question's stage version must belong to this interview.
    const owned = await this.prisma.interviewStage.findFirst({
      where: {
        interviewSessionId: interviewId,
        pipelineStageVersionId: questionVersion.pipelineStageVersionId,
      },
      select: { id: true },
    });
    if (!owned) {
      throw new NotFoundException(
        'Question does not belong to this interview',
      );
    }

    return {
      interviewId,
      question: {
        id: questionVersion.id,
        order: questionVersion.order,
        type: questionVersion.type,
        required: questionVersion.required,
        question: questionVersion.question,
        options: questionVersion.options
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((o) => ({ id: o.id, text: o.text, order: o.order })),
      },
      rubricCriteria: questionVersion.rubricCriteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        maxScore: c.maxScore,
      })),
      stageVersion: {
        id: questionVersion.pipelineStageVersion.id,
        name: questionVersion.pipelineStageVersion.name,
        order: questionVersion.pipelineStageVersion.order,
      },
    };
  }

  /**
   * Progress counters plus the runtime stage map — the scheduler view the
   * conversational agent uses to know where the candidate stands.
   */
  async getInterviewProgress(interviewId: string) {
    if (!UUID_RE.test(interviewId)) {
      throw new BadRequestException('interviewId must be a UUID');
    }

    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
      include: {
        currentStage: true,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    const stages = await this.prisma.interviewStage.findMany({
      where: { interviewSessionId: interview.id },
      orderBy: { order: 'asc' },
    });

    const answeredQuestionIds = new Set(
      (
        await this.prisma.answer.findMany({
          where: { interviewSessionId: interview.id },
          select: { questionVersionId: true },
        })
      ).map((a) => a.questionVersionId),
    );

    const stageVersionIds = stages.map((s) => s.pipelineStageVersionId);
    const totalQuestionCount = stageVersionIds.length
      ? await this.prisma.questionVersion.count({
          where: { pipelineStageVersionId: { in: stageVersionIds } },
        })
      : 0;

    return {
      interviewId: interview.id,
      interviewStatus: interview.status,
      progress: {
        totalStages: stages.length,
        completedStages: stages.filter((s) => s.status === 'COMPLETED').length,
        totalQuestions: totalQuestionCount,
        answeredQuestions: answeredQuestionIds.size,
      },
      stages: stages.map((s) => ({
        id: s.id,
        order: s.order,
        status: s.status,
        pipelineStageVersionId: s.pipelineStageVersionId,
        isCurrent: interview.currentStageId === s.id,
      })),
      currentStageId: interview.currentStageId,
    };
  }

  /**
   * Conversation transcript (agent context). One Conversation row per
   * interview session; messages ordered by createdAt.
   */
  async getTranscript(interviewId: string) {
    if (!UUID_RE.test(interviewId)) {
      throw new BadRequestException('interviewId must be a UUID');
    }

    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { interviewSessionId: interviewId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      conversationId: conversation?.id ?? null,
      messages: conversation?.messages ?? [],
    };
  }

  async appendMessage(interviewId: string, dto: CreateInternalMessageDto) {
    if (!UUID_RE.test(interviewId)) {
      throw new BadRequestException('interviewId must be a UUID');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { interviewSessionId: interviewId },
    });
    if (!conversation) {
      throw new NotFoundException(
        'Conversation has not been created for this interview session',
      );
    }

    return this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: dto.role,
        content: dto.content,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        role: true,
        content: true,
        metadata: true,
        createdAt: true,
      },
    });
  }

  /**
   * Delegates to the proven runtime answer flow (validation, duplicate
   * protection, question → stage → interview progression). Answer type is
   * TRANSCRIPT — the conversational interviewer persists candidate speech.
   */
  async submitAnswer(interviewId: string, dto: SubmitInternalAnswerDto) {
    const result = await this.interviews.submitAnswer(interviewId, {
      questionId: dto.questionId,
      content: dto.content,
    });

    const answerId = (result as { answer?: { id?: string } }).answer?.id;
    if (answerId) {
      await this.prisma.answer.update({
        where: { id: answerId },
        data: { type: 'TRANSCRIPT' },
      });
    }

    return result;
  }

  // ----------------------------------------------------------- evaluations

  /** Create a PENDING evaluation (one per model under two-model scoring). */
  async createEvaluation(dto: CreateEvaluationDto): Promise<AIEvaluation> {
    if (!UUID_RE.test(dto.interviewSessionId)) {
      throw new BadRequestException('interviewSessionId must be a UUID');
    }
    if (!UUID_RE.test(dto.answerId)) {
      throw new BadRequestException('answerId must be a UUID');
    }

    const answer = await this.prisma.answer.findFirst({
      where: { id: dto.answerId, interviewSessionId: dto.interviewSessionId },
    });
    if (!answer) {
      throw new NotFoundException(
        'Answer not found for this interview session',
      );
    }

    return this.prisma.aIEvaluation.create({
      data: {
        interviewSessionId: dto.interviewSessionId,
        answerId: dto.answerId,
        status: EvaluationStatus.PENDING,
        model: dto.model,
      },
    });
  }

  async completeEvaluation(id: string, dto: CompleteEvaluationDto) {
    if (!UUID_RE.test(id)) {
      throw new BadRequestException('evaluation id must be a UUID');
    }

    const evaluation = await this.prisma.aIEvaluation.findUnique({
      where: { id },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }
    if (evaluation.status !== EvaluationStatus.PENDING) {
      throw new BadRequestException(
        `Evaluation is ${evaluation.status}; only PENDING evaluations can be completed`,
      );
    }

    return this.prisma.aIEvaluation.update({
      where: { id },
      data: {
        status: EvaluationStatus.COMPLETED,
        score: new Prisma.Decimal(dto.score),
        reasoning: dto.reasoning,
        result: (dto.result ?? undefined) as Prisma.InputJsonValue,
      },
    });
  }

  async failEvaluation(id: string, dto: FailEvaluationDto) {
    if (!UUID_RE.test(id)) {
      throw new BadRequestException('evaluation id must be a UUID');
    }

    const evaluation = await this.prisma.aIEvaluation.findUnique({
      where: { id },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }
    if (evaluation.status !== EvaluationStatus.PENDING) {
      throw new BadRequestException(
        `Evaluation is ${evaluation.status}; only PENDING evaluations can be failed`,
      );
    }

    return this.prisma.aIEvaluation.update({
      where: { id },
      data: {
        status: EvaluationStatus.FAILED,
        reasoning: dto.error,
        result: (dto.result ?? undefined) as Prisma.InputJsonValue,
      },
    });
  }

  // ---------------------------------------------------------------- scoring

  /**
   * Transactional upsert of Score + CriterionScores keyed by the
   * (applicationId, questionVersionId) unique constraint. Re-running an
   * evaluation replaces the criterion breakdown instead of duplicating it.
   */
  async upsertScore(dto: UpsertScoreDto) {
    if (dto.overallScore > dto.maxScore) {
      throw new BadRequestException('overallScore cannot exceed maxScore');
    }

    const invalid = (dto.criteria ?? []).find(
      (c) => c.score > Number.MAX_SAFE_INTEGER,
    );
    if (invalid) {
      throw new BadRequestException('Criterion score out of range');
    }

    const criterionVersionIds = (dto.criteria ?? []).map(
      (c) => c.rubricCriterionVersionId,
    );
    if (criterionVersionIds.length > 0) {
      const valid = await this.prisma.rubricCriterionVersion.findMany({
        where: {
          id: { in: criterionVersionIds },
          questionVersionId: dto.questionVersionId,
        },
        select: { id: true },
      });
      if (valid.length !== new Set(criterionVersionIds).size) {
        throw new BadRequestException(
          'One or more criteria do not belong to this question version',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const score = await tx.score.upsert({
        where: {
          applicationId_questionVersionId: {
            applicationId: dto.applicationId,
            questionVersionId: dto.questionVersionId,
          },
        },
        create: {
          applicationId: dto.applicationId,
          questionVersionId: dto.questionVersionId,
          overallScore: dto.overallScore,
          maxScore: dto.maxScore,
          reasoning: dto.reasoning,
        },
        update: {
          overallScore: dto.overallScore,
          maxScore: dto.maxScore,
          reasoning: dto.reasoning,
        },
      });

      if (dto.criteria) {
        await tx.criterionScore.deleteMany({ where: { scoreId: score.id } });
        if (dto.criteria.length > 0) {
          await tx.criterionScore.createMany({
            data: dto.criteria.map((c) => ({
              scoreId: score.id,
              rubricCriterionVersionId: c.rubricCriterionVersionId,
              score: c.score,
              reasoning: c.reasoning,
            })),
          });
        }
      }

      return tx.score.findUniqueOrThrow({
        where: { id: score.id },
        include: { criterionScores: true },
      });
    });
  }

  /** Aggregate question scores → application totals (+ per-question rows). */
  async getApplicationScoreSummary(applicationId: string) {
    if (!UUID_RE.test(applicationId)) {
      throw new BadRequestException('applicationId must be a UUID');
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const scores = await this.prisma.score.findMany({
      where: { applicationId },
      include: { criterionScores: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalScore = scores.reduce((sum, s) => sum + s.overallScore, 0);
    const maxScore = scores.reduce((sum, s) => sum + s.maxScore, 0);
    const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    return {
      applicationId,
      // Callers (Action MCP) org-scope decisions against the owning org, so the
      // summary must carry it — otherwise the check silently no-ops.
      organizationId: application.organizationId,
      totalScore,
      maxScore,
      percentage: pct,
      questionCount: scores.length,
      questions: scores,
    };
  }

  /**
   * Full scoring context for one answer: the frozen question version
   * (verbatim text + options), its rubric criteria, and the answer content.
   * Scoring MCP uses this to build the evaluation prompt — the backend is
   * the source of truth, so the agent never echoes caller-supplied text.
   */
  async getAnswerContext(answerId: string) {
    if (!UUID_RE.test(answerId)) {
      throw new BadRequestException('answerId must be a UUID');
    }

    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId },
      include: {
        interviewSession: {
          select: {
            id: true,
            status: true,
            application: {
              select: {
                id: true,
                organizationId: true,
                candidate: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        questionVersion: {
          include: {
            options: { orderBy: { order: 'asc' }, select: { id: true, text: true, order: true } },
            rubricCriteria: {
              orderBy: { name: 'asc' },
              select: { id: true, name: true, description: true, maxScore: true },
            },
          },
        },
      },
    });
    if (!answer) {
      throw new NotFoundException('Answer not found');
    }

    return {
      answer: {
        id: answer.id,
        type: answer.type,
        content: answer.content,
        submittedAt: answer.submittedAt,
      },
      questionVersion: {
        id: answer.questionVersion.id,
        order: answer.questionVersion.order,
        type: answer.questionVersion.type,
        required: answer.questionVersion.required,
        question: answer.questionVersion.question,
        options: answer.questionVersion.options,
      },
      rubricCriteria: answer.questionVersion.rubricCriteria,
      interview: {
        id: answer.interviewSession.id,
        status: answer.interviewSession.status,
      },
      application: {
        id: answer.interviewSession.application.id,
        organizationId: answer.interviewSession.application.organizationId,
        candidate: answer.interviewSession.application.candidate,
      },
    };
  }

  /**
   * All score rows (with criterion breakdowns) for one application — the
   * input to decision generation. Ordered by creation.
   */
  async listApplicationScores(applicationId: string) {
    if (!UUID_RE.test(applicationId)) {
      throw new BadRequestException('applicationId must be a UUID');
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return this.prisma.score.findMany({
      where: { applicationId },
      include: { criterionScores: { include: { rubricCriterionVersion: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ---------------------------------------------------------------- actions

  /**
   * Final-stage completion sweep. Called by Action MCP once the agent knows
   * the last question is answered; the backend remains the state authority
   * (submitAnswer auto-completes when the final answer lands, so this is a
   * guarded no-op path for safety/recovery).
   */
  async completeInterview(interviewId: string) {
    if (!UUID_RE.test(interviewId)) {
      throw new BadRequestException('interviewId must be a UUID');
    }

    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview) {
      throw new NotFoundException('Interview session not found');
    }
    if (interview.status === InterviewSessionStatus.COMPLETED) {
      return { interviewId, status: interview.status, alreadyCompleted: true };
    }
    if (interview.status !== InterviewSessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Interview cannot be completed from ${interview.status} status`,
      );
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.interviewSession.update({
        where: { id: interviewId },
        data: {
          status: InterviewSessionStatus.COMPLETED,
          completedAt: now,
          currentStageId: null,
        },
      }),
      this.prisma.application.update({
        where: { id: interview.applicationId },
        data: { status: 'COMPLETED', completedAt: now },
      }),
    ]);

    return { interviewId, status: 'COMPLETED', alreadyCompleted: false };
  }

  /**
   * Create the application decision (one per application). The AI/system
   * recommendation is persisted here; human overrides go through the
   * recruiter endpoint and always preserve history via DecisionOverride.
   */
  async createDecision(applicationId: string, dto: CreateInternalDecisionDto) {
    if (!UUID_RE.test(applicationId)) {
      throw new BadRequestException('applicationId must be a UUID');
    }
    if (dto.totalScore > dto.maxScore) {
      throw new BadRequestException('totalScore cannot exceed maxScore');
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const existing = await this.prisma.decision.findUnique({
      where: { applicationId },
    });
    if (existing) {
      throw new BadRequestException(
        'A decision already exists for this application',
      );
    }

    const decision = await this.prisma.decision.create({
      data: {
        applicationId,
        outcome: dto.outcome,
        totalScore: dto.totalScore,
        maxScore: dto.maxScore,
        reasoning: dto.reasoning,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: application.organizationId,
        actorType: 'AI',
        actorId: dto.requestedBy ?? 'ai-service',
        action: 'DECISION_CREATED',
        entityType: 'Decision',
        entityId: decision.id,
        metadata: {
          outcome: dto.outcome,
          totalScore: dto.totalScore,
          maxScore: dto.maxScore,
          requestedBy: dto.requestedBy ?? 'ai-service',
        },
      },
    });

    return decision;
  }

  /** Append an audit event (AI/SYSTEM/HUMAN actor typing lives in the DTO). */
  async createAuditEvent(dto: CreateAuditEventDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorType: dto.actorType,
        actorId: dto.actorId,
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue,
      },
    });
  }

  /** List audit events for an organization (recency order). */
  async listAuditEvents(organizationId: string, limit = 100) {
    // NOTE: organization ids are Better Auth-generated strings (not UUIDs);
    // existence is verified by the lookup below.

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
