import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import type express from 'express';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { PipelinesService } from './pipelines.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { getAuthContext } from '../auth/utils/session';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';

@Controller('pipelines')
@UseGuards(PermissionsGuard)
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Post()
  @RequirePermissions(Permission.PIPELINE_CREATE)
  async create(
    @Req() request: express.Request,
    @Body() dto: CreatePipelineDto,
  ) {
    const { userId, organizationId } = await getAuthContext(request);

    return this.pipelinesService.create(organizationId, userId, dto);
  }

  @Get()
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async findAll(@Req() request: express.Request) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelinesService.findAll(organizationId);
  }

  @Get(':id')
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async findOne(@Req() request: express.Request, @Param('id') id: string) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelinesService.findOne(organizationId, id);
  }

  /**
   * Freeze the current draft into a new immutable PipelineVersion. Jobs
   * already pinned to an older version keep using it (master-note §10).
   */
  @Post(':id/publish')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async publishVersion(
    @Req() request: express.Request,
    @Param('id') id: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelinesService.publishVersion(organizationId, id);
  }

  /** Published snapshots for this pipeline (read-only history). */
  @Get(':id/versions')
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async listVersions(@Req() request: express.Request, @Param('id') id: string) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelinesService.listVersions(organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async update(
    @Req() request: express.Request,
    @Param('id') id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelinesService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.PIPELINE_DELETE)
  async remove(@Req() request: express.Request, @Param('id') id: string) {
    const { organizationId } = await getAuthContext(request);

    return this.pipelinesService.remove(organizationId, id);
  }
}
