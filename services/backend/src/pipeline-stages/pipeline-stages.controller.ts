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

import { PipelineStagesService } from './pipeline-stages.service';
import { CreatePipelineStageDto } from './dto/create-pipeline-stage.dto';
import { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';

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

  @Get()
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async findAll(
    @Req() request: express.Request,
    @Param('pipelineId') pipelineId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelineStagesService.findAll(organizationId, pipelineId);
  }

  @Get(':stageId')
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async findOne(
    @Req() request: express.Request,
    @Param('pipelineId') pipelineId: string,
    @Param('stageId') stageId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelineStagesService.findOne(
      organizationId,
      pipelineId,
      stageId,
    );
  }

  @Patch(':stageId')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async update(
    @Req() request: express.Request,
    @Param('pipelineId') pipelineId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdatePipelineStageDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelineStagesService.update(
      organizationId,
      pipelineId,
      stageId,
      dto,
    );
  }

  @Delete(':stageId')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async remove(
    @Req() request: express.Request,
    @Param('pipelineId') pipelineId: string,
    @Param('stageId') stageId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelineStagesService.remove(
      organizationId,
      pipelineId,
      stageId,
    );
  }
}
