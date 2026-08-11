import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { CandidateService } from './candidate.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import express from 'express';
import { getAuthContext } from '../auth/utils/session';

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
}
