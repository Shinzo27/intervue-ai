import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import express from 'express';

import { PipelineStagesService } from './pipeline-stages.service';
import { CreatePipelineStageDto } from './dto/create-pipeline-stage.dto';

import { PermissionsGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';
import { getAuthContext } from '../auth/utils/session';

@Controller('pipelines/:pipelineId/stages')
@UseGuards(PermissionsGuard)
export class PipelineStagesController {
  constructor(private readonly pipelineStagesService: PipelineStagesService) {}

  @Post()
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async create(
    @Req() request: express.Request,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: CreatePipelineStageDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelineStagesService.create(organizationId, pipelineId, dto);
  }
}
