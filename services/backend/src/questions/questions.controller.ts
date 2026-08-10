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
import express from 'express';

import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateQuestionOptionDto } from './dto/options/create-question-option.dto';
import { UpdateQuestionOptionDto } from './dto/options/update-question-option.dto';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';
import { getAuthContext } from '../auth/utils/session';
import { CreateRubricCriterionDto } from './dto/rubrics/create-rubric-criterion.dto';
import { UpdateRubricCriterionDto } from './dto/rubrics/update-rubric-criterion.dto';

@Controller('stages/:stageId/questions')
@UseGuards(PermissionsGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async create(
    @Req() request: express.Request,
    @Param('stageId') stageId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.create(organizationId, stageId, dto);
  }

  @Get()
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async findAll(
    @Req() request: express.Request,
    @Param('stageId') stageId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.findAll(organizationId, stageId);
  }

  @Get(':questionId')
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async findOne(
    @Req() request: express.Request,
    @Param('stageId') stageId: string,
    @Param('questionId') questionId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.findOne(organizationId, stageId, questionId);
  }

  @Patch(':questionId')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async update(
    @Req() request: express.Request,
    @Param('stageId') stageId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.update(
      organizationId,
      stageId,
      questionId,
      dto,
    );
  }

  @Delete(':questionId')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async remove(
    @Req() request: express.Request,
    @Param('stageId') stageId: string,
    @Param('questionId') questionId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.remove(organizationId, stageId, questionId);
  }

  @Post(':questionId/options')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async createOption(
    @Req() request: express.Request,
    @Param('questionId') questionId: string,
    @Body() dto: CreateQuestionOptionDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.createOption(organizationId, questionId, dto);
  }

  @Get(':questionId/options')
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async findAllOptions(
    @Req() request: express.Request,
    @Param('questionId') questionId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.findAllOptions(organizationId, questionId);
  }

  @Get(':questionId/options/:optionId')
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async findOneOption(
    @Req() request: express.Request,
    @Param('questionId') questionId: string,
    @Param('optionId') optionId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.findOneOption(
      organizationId,
      questionId,
      optionId,
    );
  }

  @Patch(':questionId/options/:optionId')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async updateOption(
    @Req() request: express.Request,
    @Param('questionId') questionId: string,
    @Param('optionId') optionId: string,
    @Body() dto: UpdateQuestionOptionDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.updateOption(
      organizationId,
      questionId,
      optionId,
      dto,
    );
  }

  @Delete(':questionId/options/:optionId')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async removeOption(
    @Req() request: express.Request,
    @Param('questionId') questionId: string,
    @Param('optionId') optionId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.removeOption(
      organizationId,
      questionId,
      optionId,
    );
  }

  @Post(':questionId/rubrics')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async createRubric(
    @Req() request: express.Request,
    @Param('questionId') questionId: string,
    @Body() dto: CreateRubricCriterionDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.createRubric(organizationId, questionId, dto);
  }

  @Get(':questionId/rubrics')
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async findAllRubrics(
    @Req() request: express.Request,
    @Param('questionId') questionId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.findAllRubrics(organizationId, questionId);
  }

  @Get(':questionId/rubrics/:rubricId')
  @RequirePermissions(Permission.PIPELINE_VIEW)
  async findOneRubric(
    @Req() request: express.Request,
    @Param('questionId') questionId: string,
    @Param('rubricId') rubricId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.findOneRubric(
      organizationId,
      questionId,
      rubricId,
    );
  }

  @Patch(':questionId/rubrics/:rubricId')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async updateRubric(
    @Req() request: express.Request,
    @Param('questionId') questionId: string,
    @Param('rubricId') rubricId: string,
    @Body() dto: UpdateRubricCriterionDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.updateRubric(
      organizationId,
      questionId,
      rubricId,
      dto,
    );
  }

  @Delete(':questionId/rubrics/:rubricId')
  @RequirePermissions(Permission.PIPELINE_UPDATE)
  async removeRubric(
    @Req() request: express.Request,
    @Param('questionId') questionId: string,
    @Param('rubricId') rubricId: string,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.questionsService.removeRubric(
      organizationId,
      questionId,
      rubricId,
    );
  }
}
