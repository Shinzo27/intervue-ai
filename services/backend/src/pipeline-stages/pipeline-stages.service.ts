import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineStageDto } from './dto/create-pipeline-stage.dto';

@Injectable()
export class PipelineStagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    pipelineId: string,
    dto: CreatePipelineStageDto,
  ) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        organizationId,
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return this.prisma.pipelineStage.create({
      data: {
        name: dto.name,
        order: dto.order,
        pipelineId,
      },
    });
  }
}
