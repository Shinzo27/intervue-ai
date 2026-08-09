import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import express from 'express';
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
}
