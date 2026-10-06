import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { OverrideDecisionDto } from './dto/override-decision.dto';
import { getAuthContext } from 'src/auth/utils/session';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';
import express from 'express';

/**
 * Recruiter-facing interview surface.
 *
 * The guard is class-level so every route resolves the caller's active
 * organization; routes that declare no permission still pass through it, but
 * the privileged decision routes below REQUIRE their capability — recording a
 * decision and replacing one are different levels of authority (§43, §44).
 */
@Controller('interviews')
@UseGuards(PermissionsGuard)
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  async createInterview(@Body() dto: CreateInterviewDto) {
    return this.interviewsService.createInterview(dto.applicationId);
  }

  @Post(':interviewId/start')
  async startInterview(@Param('interviewId') interviewId: string) {
    return this.interviewsService.startInterview(interviewId);
  }

  @Get(':interviewId/current')
  async getCurrentInterview(@Param('interviewId') interviewId: string) {
    return this.interviewsService.getCurrentInterview(interviewId);
  }

  @Post(':interviewId/answers')
  async submitAnswer(
    @Param('interviewId') interviewId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.interviewsService.submitAnswer(interviewId, dto);
  }

  @Post(':interviewId/answers/:answerId/evaluate')
  async evaluateAnswer(
    @Param('interviewId') interviewId: string,
    @Param('answerId') answerId: string,
  ) {
    return this.interviewsService.evaluateAnswer(interviewId, answerId);
  }

  @Post(':interviewId/conversation')
  async createConversation(@Param('interviewId') interviewId: string) {
    return this.interviewsService.createConversation(interviewId);
  }

  @Post(':interviewId/conversation/messages')
  async createMessage(
    @Param('interviewId') interviewId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.interviewsService.createMessage(interviewId, dto);
  }

  @Get(':interviewId/conversation')
  async getConversation(@Param('interviewId') interviewId: string) {
    return this.interviewsService.getConversation(interviewId);
  }

  @Post(':interviewId/decision')
  @RequirePermissions(Permission.INTERVIEW_EVALUATE)
  async createDecision(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
    @Body() dto: CreateDecisionDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.interviewsService.createDecision(interviewId, dto, organizationId);
  }

  /**
   * Human override (§44). Requires `decision:override` — the AI actor can never
   * hold this capability, which is what keeps "AI never overwrites a human
   * decision" true in both directions. The organizationId is passed through so
   * the service can refuse to touch another tenant's decision.
   */
  @Post(':interviewId/decision/override')
  @RequirePermissions(Permission.DECISION_OVERRIDE)
  async overrideDecision(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
    @Body() dto: OverrideDecisionDto,
  ) {
    const { userId, organizationId } = await getAuthContext(request);

    return this.interviewsService.overrideDecision(
      interviewId,
      userId,
      dto,
      organizationId,
    );
  }
}
