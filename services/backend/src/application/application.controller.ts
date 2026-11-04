import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import type express from 'express';
import { getAuthContext } from '../auth/utils/session';
import { InviteCandidateDto } from './dto/invite-candidate.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';
import { PermissionsGuard } from '../auth/guards/permission.guard';

@Controller('applications')
@UseGuards(PermissionsGuard)
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post()
  async create(
    @Req() request: express.Request,
    @Body() dto: CreateApplicationDto,
  ) {
    const { organizationId } = await getAuthContext(request);
    return this.applicationService.create(organizationId, dto);
  }

  @Get()
  async findAll(@Req() request: express.Request) {
    const { organizationId } = await getAuthContext(request);
    return this.applicationService.findAll(organizationId);
  }

  @Get(':id')
  async findOne(@Req() request: express.Request, @Param('id') id: string) {
    const { organizationId } = await getAuthContext(request);
    return this.applicationService.findOne(organizationId, id);
  }

  /**
   * Review aggregate for the recruiter review screen: frozen questions,
   * answers, per-question scores with criterion breakdowns, every AI
   * evaluation, and the decision with its override history.
   * `interview:evaluate` is the capability that unlocks reviewing scores.
   */
  @Get(':id/review')
  @RequirePermissions(Permission.INTERVIEW_EVALUATE)
  async getReview(@Req() request: express.Request, @Param('id') id: string) {
    const { organizationId } = await getAuthContext(request);
    return this.applicationService.getReview(organizationId, id);
  }

  @Post('invite')
  async inviteCandidate(
    @Req() request: express.Request,
    @Body() dto: InviteCandidateDto,
  ) {
    const { organizationId } = await getAuthContext(request);
    return this.applicationService.inviteCandidate(organizationId, dto);
  }
}
