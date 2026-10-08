import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import {
  createPipelineVersionSnapshot,
  validateDraftForPublish,
} from './pipeline-snapshot';

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, userId: string, dto: CreatePipelineDto) {
    return this.prisma.pipeline.create({
      data: {
        name: dto.name,
        organizationId,
        createdById: userId,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.pipeline.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        stages: {
          include: {
            questions: {
              include: {
                options: true,
                rubricCriteria: true,
              },
            },
          },
        },
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return pipeline;
  }

  async update(organizationId: string, id: string, dto: UpdatePipelineDto) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return this.prisma.pipeline.update({
      where: {
        id: pipeline.id,
      },
      data: {
        name: dto.name,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    await this.prisma.pipeline.delete({
      where: {
        id: pipeline.id,
      },
    });

    return {
      message: 'Pipeline deleted successfully',
    };
  }

  /**
   * Publish the current draft as a new immutable snapshot (master-note §10).
   * Versions are cumulative — publishing twice produces v1 then v2, and jobs
   * already pinned to v1 keep using it.
   */
  async publishVersion(organizationId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, organizationId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: { orderBy: { order: 'asc' } },
                rubricCriteria: true,
              },
            },
          },
        },
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    validateDraftForPublish(pipeline.stages);

    const version = await this.prisma.$transaction((tx) =>
      createPipelineVersionSnapshot(tx, pipeline.id, pipeline.stages),
    );

    return {
      id: version.id,
      pipelineId: pipeline.id,
      version: version.version,
      status: version.status,
      publishedAt: version.publishedAt,
      stageCount: pipeline.stages.length,
      questionCount: pipeline.stages.reduce(
        (total, stage) => total + stage.questions.length,
        0,
      ),
    };
  }

  /** Published snapshots for a pipeline (newest first) — read-only history. */
  async listVersions(organizationId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    const versions = await this.prisma.pipelineVersion.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { version: 'desc' },
      include: {
        stages: { select: { id: true, _count: { select: { questions: true } } } },
        _count: { select: { jobPostings: true } },
      },
    });

    return versions.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      publishedAt: version.publishedAt,
      stageCount: version.stages.length,
      questionCount: version.stages.reduce(
        (total, stage) => total + stage._count.questions,
        0,
      ),
      jobCount: version._count.jobPostings,
    }));
  }
}
