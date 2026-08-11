import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { InterviewService } from './interview.service';
import express from 'express';
import { getAuthContext } from '../auth/utils/session';

@Controller('interviews')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post('applications/:applicationId')
  async create(
    @Req() req: express.Request,
    @Param('applicationId') applicationId: string,
  ) {
    const { organizationId } = await getAuthContext(req);
    return this.interviewService.createForApplication(
      organizationId,
      applicationId,
    );
  }

  @Get('entry/:token')
  getByToken(@Param('token') token: string) {
    return this.interviewService.getByToken(token);
  }
}
