import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';

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
}
