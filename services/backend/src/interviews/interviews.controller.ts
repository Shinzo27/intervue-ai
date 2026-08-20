import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { OverrideDecisionDto } from './dto/override-decision.dto';
import { getAuthContext } from 'src/auth/utils/session';
import express from 'express';

@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  async createInterview(@Body() dto: CreateInterviewDto) {
    return this.interviewsService.createInterview(dto.applicationId);
  }

  @Get('access/:token')
  async accessInterview(@Param('token') token: string) {
    return this.interviewsService.accessInterview(token);
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
  async createDecision(
    @Param('interviewId') interviewId: string,
    @Body() dto: CreateDecisionDto,
  ) {
    return this.interviewsService.createDecision(interviewId, dto);
  }

  @Post(':interviewId/decision/override')
  async overrideDecision(
    @Req() request: express.Request,
    @Param('interviewId') interviewId: string,
    @Body() dto: OverrideDecisionDto,
  ) {
    const { userId } = await getAuthContext(request);

    return this.interviewsService.overrideDecision(interviewId, userId, dto);
  }
}
