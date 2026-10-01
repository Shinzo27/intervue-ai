import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Public } from '@thallesp/nestjs-better-auth';
import express from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { InternalService } from './internal.service';
import { ApiResponseFormat } from '../common/interceptors/response/api-response-format.decorator';
import { CreateInternalMessageDto } from './dto/create-internal-message.dto';
import { SubmitInternalAnswerDto } from './dto/submit-internal-answer.dto';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { CompleteEvaluationDto } from './dto/complete-evaluation.dto';
import { FailEvaluationDto } from './dto/fail-evaluation.dto';
import { UpsertScoreDto } from './dto/upsert-score.dto';
import { CreateInternalDecisionDto } from './dto/create-internal-decision.dto';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';

/**
 * Service-to-service capability surface for ai-service (MCP tools).
 *
 * Auth model: `Authorization: Internal <INTERNAL_SERVICE_SECRET>` — the
 * shared-secret boundary between the two services. The MCP layer must never
 * reach the database directly; every business read/write goes through here.
 *
 * `@Public()` only opts the routes out of the Better Auth *session* guard
 * (the package registers a global APP_GUARD); these endpoints remain
 * protected by InternalServiceGuard below — service-token auth, zero
 * browser/session surface.
 */
@Controller('internal')
@Public()
@UseGuards(InternalServiceGuard)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly internalService: InternalService,
  ) {}

  // ----------------------------------------------------------------- reads

  @Get('interviews/:id/state')
  @ApiResponseFormat()
  async getInterviewState(@Param('id') id: string) {
    return this.internalService.getInterviewState(id);
  }

  @Get('interviews/:id/current-question')
  @ApiResponseFormat()
  async getCurrentQuestion(@Param('id') id: string) {
    return this.internalService.getCurrentQuestion(id);
  }

  @Get('interviews/:id/stages/:stageVersionId/questions')
  @ApiResponseFormat()
  async getStageQuestions(
    @Param('id') id: string,
    @Param('stageVersionId') stageVersionId: string,
  ) {
    return this.internalService.getStageQuestions(id, stageVersionId);
  }

  @Get('interviews/:id/questions/:questionVersionId')
  @ApiResponseFormat()
  async getQuestionDetails(
    @Param('id') id: string,
    @Param('questionVersionId') questionVersionId: string,
  ) {
    return this.internalService.getQuestionDetails(id, questionVersionId);
  }

  @Get('interviews/:id/progress')
  @ApiResponseFormat()
  async getInterviewProgress(@Param('id') id: string) {
    return this.internalService.getInterviewProgress(id);
  }

  @Get('interviews/:id/transcript')
  @ApiResponseFormat()
  async getTranscript(@Param('id') id: string) {
    return this.internalService.getTranscript(id);
  }

  // ------------------------------------------------------------- messaging

  /** Idempotent bootstrap for the conversational agent's transcript. */
  @Post('interviews/:id/conversation')
  @ApiResponseFormat()
  async ensureConversation(@Param('id') id: string) {
    return this.internalService.ensureConversation(id);
  }

  @Post('interviews/:id/messages')
  @ApiResponseFormat()
  async appendMessage(
    @Param('id') id: string,
    @Body() dto: CreateInternalMessageDto,
  ) {
    return this.internalService.appendMessage(id, dto);
  }

  // --------------------------------------------------------------- answers

  @Post('interviews/:id/answers')
  @ApiResponseFormat()
  async submitAnswer(
    @Param('id') id: string,
    @Body() dto: SubmitInternalAnswerDto,
  ) {
    return this.internalService.submitAnswer(id, dto);
  }

  // ----------------------------------------------------------- evaluations

  @Post('evaluations')
  @ApiResponseFormat()
  async createEvaluation(@Body() dto: CreateEvaluationDto) {
    return this.internalService.createEvaluation(dto);
  }

  @Patch('evaluations/:id/complete')
  @ApiResponseFormat()
  async completeEvaluation(
    @Param('id') id: string,
    @Body() dto: CompleteEvaluationDto,
  ) {
    return this.internalService.completeEvaluation(id, dto);
  }

  @Patch('evaluations/:id/fail')
  @ApiResponseFormat()
  async failEvaluation(
    @Param('id') id: string,
    @Body() dto: FailEvaluationDto,
  ) {
    return this.internalService.failEvaluation(id, dto);
  }

  // --------------------------------------------------------------- scoring

  @Post('scores')
  @ApiResponseFormat()
  async upsertScore(@Body() dto: UpsertScoreDto) {
    return this.internalService.upsertScore(dto);
  }

  @Get('applications/:id/score-summary')
  @ApiResponseFormat()
  async getApplicationScoreSummary(@Param('id') id: string) {
    return this.internalService.getApplicationScoreSummary(id);
  }

  @Get('answers/:id/context')
  @ApiResponseFormat()
  async getAnswerContext(@Param('id') id: string) {
    return this.internalService.getAnswerContext(id);
  }

  @Get('applications/:id/scores')
  @ApiResponseFormat()
  async listApplicationScores(@Param('id') id: string) {
    return this.internalService.listApplicationScores(id);
  }

  // --------------------------------------------------------------- actions

  @Post('interviews/:id/complete')
  @ApiResponseFormat()
  async completeInterview(@Param('id') id: string) {
    return this.internalService.completeInterview(id);
  }

  @Post('applications/:id/decision')
  @ApiResponseFormat()
  async createDecision(
    @Param('id') id: string,
    @Body() dto: CreateInternalDecisionDto,
  ) {
    return this.internalService.createDecision(id, dto);
  }

  // ------------------------------------------------------------ audit logs

  @Post('audit-events')
  @ApiResponseFormat()
  async createAuditEvent(@Body() dto: CreateAuditEventDto) {
    return this.internalService.createAuditEvent(dto);
  }

  @Get('audit/:organizationId')
  @ApiResponseFormat()
  async listAuditEvents(
    @Param('organizationId') organizationId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.internalService.listAuditEvents(
      organizationId,
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  // ------------------------------------------------------------- legacy v0

  /**
   * v0 candidate-token validation used by the invitation flow. Superseded
   * over time by the typed capability surface above; kept until callers
   * migrate.
   */
  @Post('candidate/validate')
  async validateCandidate(@Body() body: { token?: string }) {
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
