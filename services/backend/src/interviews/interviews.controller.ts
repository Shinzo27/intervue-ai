import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

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
}
