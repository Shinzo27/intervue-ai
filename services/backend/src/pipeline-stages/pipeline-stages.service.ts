import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineStageDto } from './dto/create-pipeline-stage.dto';
import { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';

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

    try {
      return await this.prisma.pipelineStage.create({
        data: {
          name: dto.name,
          order: dto.order,
          pipelineId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `A stage with this order (${dto.order}) already exists in the pipeline`,
        );
      }

      throw error;
    }
  }

  async findAll(organizationId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        organizationId,
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return this.prisma.pipelineStage.findMany({
      where: {
        pipelineId,
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  async findOne(organizationId: string, pipelineId: string, stageId: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: {
        id: stageId,
        pipelineId,
        pipeline: {
          organizationId,
        },
      },
    });

    if (!stage) {
      throw new NotFoundException('Pipeline stage not found');
    }

    return stage;
  }

  async update(
    organizationId: string,
    pipelineId: string,
    stageId: string,
    dto: UpdatePipelineStageDto,
  ) {
    await this.findOne(organizationId, pipelineId, stageId);

    try {
      return await this.prisma.pipelineStage.update({
        where: {
          id: stageId,
        },
        data: {
          name: dto.name,
          order: dto.order,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A stage with this order already exists in the pipeline',
        );
      }

      throw error;
    }
  }

  async remove(organizationId: string, pipelineId: string, stageId: string) {
    await this.findOne(organizationId, pipelineId, stageId);

    await this.prisma.pipelineStage.delete({
      where: {
        id: stageId,
      },
    });

    return {
      message: 'Pipeline stage deleted successfully',
    };
  }
}
