import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Injectable()
export class ApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateApplicationDto) {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: dto.candidateId,
        organizationId,
      },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    const jobPosting = await this.prisma.jobPosting.findFirst({
      where: {
        id: dto.jobPostingId,
        organizationId,
      },
    });

    if (!jobPosting) {
      throw new NotFoundException('Job posting not found');
    }

    const existingApplication = await this.prisma.application.findUnique({
      where: {
        candidateId_jobPostingId: {
          candidateId: dto.candidateId,
          jobPostingId: dto.jobPostingId,
        },
      },
    });

    if (existingApplication) {
      throw new BadRequestException(
        'Candidate has already applied to this job',
      );
    }

    return this.prisma.application.create({
      data: {
        organizationId,
        candidateId: dto.candidateId,
        jobPostingId: dto.jobPostingId,
        status: dto.status,
      },
      include: {
        candidate: true,
        jobPosting: true,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.application.findMany({
      where: {
        organizationId,
      },
      include: {
        candidate: true,
        jobPosting: true,
        interview: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const application = await this.prisma.application.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        candidate: true,
        jobPosting: true,
        interview: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }
}
