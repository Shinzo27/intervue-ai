import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type express from 'express';

import { JobPostingsService } from './job-postings.service';

import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { UpdateJobPostingDto } from './dto/update-job-posting.dto';

import { PermissionsGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';

import { getAuthContext } from '../auth/utils/session';

@Controller('job-postings')
@UseGuards(PermissionsGuard)
export class JobPostingsController {
  constructor(private readonly jobPostingsService: JobPostingsService) {}

  @Post()
  @RequirePermissions(Permission.JOBS_CREATE)
  async create(
    @Req() request: express.Request,
    @Body() dto: CreateJobPostingDto,
  ) {
    const { organizationId, userId } = await getAuthContext(request);

    return this.jobPostingsService.create(organizationId, userId, dto);
  }

  @Get()
  @RequirePermissions(Permission.JOBS_VIEW)
  async findAll(@Req() request: express.Request) {
    const { organizationId } = await getAuthContext(request);

    return this.jobPostingsService.findAll(organizationId);
  }

  @Get(':jobPostingId')
  @RequirePermissions(Permission.JOBS_VIEW)
  async findOne(
    @Req() request: express.Request,
    @Param('jobPostingId') jobPostingId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.jobPostingsService.findOne(organizationId, jobPostingId);
  }

  @Patch(':jobPostingId')
  @RequirePermissions(Permission.JOBS_UPDATE)
  async update(
    @Req() request: express.Request,
    @Param('jobPostingId') jobPostingId: string,
    @Body() dto: UpdateJobPostingDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.jobPostingsService.update(organizationId, jobPostingId, dto);
  }

  @Delete(':jobPostingId')
  @RequirePermissions(Permission.JOBS_DELETE)
  async remove(
    @Req() request: express.Request,
    @Param('jobPostingId') jobPostingId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.jobPostingsService.remove(organizationId, jobPostingId);
  }

  @Post(':jobPostingId/publish')
  @RequirePermissions(Permission.JOBS_PUBLISH)
  async publish(
    @Req() request: express.Request,
    @Param('jobPostingId') jobPostingId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.jobPostingsService.publish(organizationId, jobPostingId);
  }
}
