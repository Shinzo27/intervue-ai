import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import express from 'express';
import { getAuthContext } from '../auth/utils/session';
import { InviteCandidateDto } from './dto/invite-candidate.dto';

@Controller('applications')
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

  @Post('invite')
  async inviteCandidate(
    @Req() request: express.Request,
    @Body() dto: InviteCandidateDto,
  ) {
    const { organizationId } = await getAuthContext(request);
    return this.applicationService.inviteCandidate(organizationId, dto);
  }
}
