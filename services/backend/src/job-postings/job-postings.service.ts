import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import {
  createPipelineVersionSnapshot,
  validateDraftForPublish,
} from '../pipelines/pipeline-snapshot';

import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { UpdateJobPostingDto } from './dto/update-job-posting.dto';

@Injectable()
export class JobPostingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateJobPostingDto,
  ) {
    if (dto.pipelineId) {
      await this.validatePipeline(organizationId, dto.pipelineId);
    }

    return this.prisma.jobPosting.create({
      data: {
        title: dto.title,
        description: dto.description,
        organizationId,
        createdById: userId,
        pipelineId: dto.pipelineId,
      },
      include: {
        pipeline: true,
      },
    });
  }

  private async validatePipeline(organizationId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        organizationId,
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    if (pipeline.status !== 'ACTIVE') {
      throw new ConflictException(
        'Inactive pipelines cannot be attached to a job posting',
      );
    }

    return pipeline;
  }

  async findAll(organizationId: string) {
    return this.prisma.jobPosting.findMany({
      where: {
        organizationId,
      },
      include: {
        pipeline: true,
        pipelineVersion: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(organizationId: string, jobPostingId: string) {
    const jobPosting = await this.prisma.jobPosting.findFirst({
      where: {
        id: jobPostingId,
        organizationId,
      },
      include: {
        pipeline: {
          include: {
            stages: {
              include: {
                questions: {
                  include: {
                    options: true,
                    rubricCriteria: true,
                  },
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },

        pipelineVersion: {
          include: {
            stages: {
              include: {
                questions: {
                  include: {
                    options: true,
                    rubricCriteria: true,
                  },
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    if (!jobPosting) {
      throw new NotFoundException('Job posting not found');
    }

    // Published job → immutable snapshot
    if (jobPosting.status === 'PUBLISHED') {
      return {
        ...jobPosting,
        pipeline: null,
        pipelineVersion: jobPosting.pipelineVersion,
      };
    }

    // Draft job → current pipeline template
    return {
      ...jobPosting,
      pipelineVersion: null,
      pipeline: jobPosting.pipeline,
    };
  }

  async update(
    organizationId: string,
    jobPostingId: string,
    dto: UpdateJobPostingDto,
  ) {
    const jobPosting = await this.findOne(organizationId, jobPostingId);

    if (jobPosting.status !== 'DRAFT') {
      throw new ConflictException('Only draft job postings can be updated');
    }

    if (dto.pipelineId) {
      await this.validatePipeline(organizationId, dto.pipelineId);
    }

    return this.prisma.jobPosting.update({
      where: {
        id: jobPostingId,
      },
      data: {
        title: dto.title,
        description: dto.description,
        pipelineId: dto.pipelineId,
      },
      include: {
        pipeline: true,
      },
    });
  }

  async remove(organizationId: string, jobPostingId: string) {
    const jobPosting = await this.findOne(organizationId, jobPostingId);

    if (jobPosting.status !== 'DRAFT') {
      throw new ConflictException('Only draft job postings can be deleted');
    }

    await this.prisma.jobPosting.delete({
      where: {
        id: jobPostingId,
      },
    });

    return {
      message: 'Job posting deleted successfully',
    };
  }

  async publish(organizationId: string, jobPostingId: string) {
    const jobPosting = await this.prisma.jobPosting.findFirst({
      where: {
        id: jobPostingId,
        organizationId,
      },
      include: {
        pipeline: {
          include: {
            stages: {
              include: {
                questions: {
                  include: {
                    options: true,
                    rubricCriteria: true,
                  },
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    // -------------------------
    // VALIDATION
    // -------------------------

    if (!jobPosting) {
      throw new NotFoundException('Job posting not found');
    }

    if (jobPosting.status !== 'DRAFT') {
      throw new ConflictException('Only draft job postings can be published');
    }

    if (!jobPosting.pipeline) {
      throw new ConflictException('A pipeline is required before publishing');
    }

    if (jobPosting.pipeline.status !== 'ACTIVE') {
      throw new ConflictException(
        'Cannot publish a job using an inactive pipeline',
      );
    }

    if (jobPosting.pipeline.stages.length === 0) {
      throw new ConflictException(
        'Pipeline must contain at least one stage before publishing',
      );
    }

    for (const stage of jobPosting.pipeline.stages) {
      for (const question of stage.questions) {
        if (question.type === 'MCQ' && question.options.length === 0) {
          throw new ConflictException(
            `MCQ question "${question.question}" must have at least one option`,
          );
        }
      }
    }

    validateDraftForPublish(jobPosting.pipeline.stages);

    return this.prisma.$transaction(async (tx) => {
      const pipelineVersion = await createPipelineVersionSnapshot(
        tx,
        jobPosting.pipeline!.id,
        jobPosting.pipeline!.stages,
      );

      // -------------------------
      // PUBLISH JOB
      // -------------------------

      const publishedJob = await tx.jobPosting.update({
        where: {
          id: jobPostingId,
        },
        data: {
          status: 'PUBLISHED',
          pipelineVersionId: pipelineVersion.id,
        },
        include: {
          pipelineVersion: {
            include: {
              stages: {
                include: {
                  questions: {
                    include: {
                      options: true,
                      rubricCriteria: true,
                    },
                    orderBy: {
                      order: 'asc',
                    },
                  },
                },
                orderBy: {
                  order: 'asc',
                },
              },
            },
          },
        },
      });

      return publishedJob;
    });
  }
}
