import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CandidateService } from './candidate.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import express from 'express';
import { getAuthContext } from '../auth/utils/session';
import { CandidateTokenGuard } from '../auth/guards/candidate-token.guard';
import type { CandidateAuthRequest } from '../auth/guards/candidate-token.guard';

@Controller('candidates')
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Post()
  async create(
    @Req() request: express.Request,
    @Body() dto: CreateCandidateDto,
  ) {
    const { organizationId } = await getAuthContext(request);

    return this.candidateService.create(organizationId, dto);
  }

  @Get('entry')
  @UseGuards(CandidateTokenGuard)
  getEntry(@Req() req: CandidateAuthRequest) {
    if (!req.candidateAuth) {
      throw new Error('Candidate auth context not found');
    }

    const { application } = req.candidateAuth;

    return {
      application: {
        id: application.id,
        status: application.status,
        tokenExpiresAt: application.tokenExpiresAt,
      },

      candidate: {
        id: application.candidate.id,
        firstName: application.candidate.firstName,
        lastName: application.candidate.lastName,
        email: application.candidate.email,
      },

      job: {
        id: application.jobPosting.id,
        title: application.jobPosting.title,
      },

      pipeline: application.jobPosting.pipelineVersion
        ? {
            id: application.jobPosting.pipelineVersion.id,

            stages: application.jobPosting.pipelineVersion.stages.map(
              (stage) => ({
                name: stage.name,
                order: stage.order,
              }),
            ),
          }
        : null,
    };
  }

  @Get()
  async findAll(@Req() request: express.Request) {
    const { organizationId } = await getAuthContext(request);

    return this.candidateService.findAll(organizationId);
  }

  @Get(':id')
  async findOne(@Req() request: express.Request, @Param('id') id: string) {
    const { organizationId } = await getAuthContext(request);

    return this.candidateService.findOne(organizationId, id);
  }

  @Post('entry/start')
  @UseGuards(CandidateTokenGuard)
  startApplication(@Req() req: CandidateAuthRequest) {
    if (!req.candidateAuth) {
      throw new UnauthorizedException('Candidate auth context not found');
    }

    return this.candidateService.startApplication(
      req.candidateAuth.applicationId,
    );
  }
}
