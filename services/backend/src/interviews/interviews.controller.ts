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
import type express from 'express';

/**
 * Recruiter-facing interview surface.
 *
 * Every route resolves the caller's active organization and hands it to the
 * service, which scopes its lookup on `application.organizationId` in the same
 * query — an interview id from another tenant reads as 404, never as another
 * tenant's data (master-note §53: queries must prevent cross-tenant access).
 *
 * Routes that declare no permission still run the class-level guard, so the
 * caller must be an authenticated member of the active organization. The
 * privileged decision routes additionally REQUIRE their capability — recording
 * a decision and replacing one are different levels of authority (§43, §44).
 */
@Controller('interviews')
@UseGuards(PermissionsGuard)
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  async createInterview(
    @Req() request: express.Request,
    @Body() dto: CreateInterviewDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.interviewsService.createInterview(
      dto.applicationId,
      organizationId,
    );
  }

  @Post(':interviewId/start')
  async startInterview(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.interviewsService.startInterview(interviewId, organizationId);
  }

  @Get(':interviewId/current')
  async getCurrentInterview(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.interviewsService.getCurrentInterview(
      interviewId,
      organizationId,
    );
  }

  @Post(':interviewId/answers')
  async submitAnswer(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.interviewsService.submitAnswer(
      interviewId,
      dto,
      organizationId,
    );
  }

  @Post(':interviewId/answers/:answerId/evaluate')
  async evaluateAnswer(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
    @Param('answerId') answerId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.interviewsService.evaluateAnswer(
      interviewId,
      answerId,
      organizationId,
    );
  }

  @Post(':interviewId/conversation')
  async createConversation(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.interviewsService.createConversation(
      interviewId,
      organizationId,
    );
  }

  @Post(':interviewId/conversation/messages')
  async createMessage(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
    @Body() dto: CreateMessageDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.interviewsService.createMessage(
      interviewId,
      dto,
      organizationId,
    );
  }

  @Get(':interviewId/conversation')
  async getConversation(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.interviewsService.getConversation(interviewId, organizationId);
  }

  @Post(':interviewId/decision')
  @RequirePermissions(Permission.INTERVIEW_EVALUATE)
  async createDecision(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
    @Body() dto: CreateDecisionDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.interviewsService.createDecision(
      interviewId,
      dto,
      organizationId,
    );
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
