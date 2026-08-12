import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateApplicationDto } from './dto/create-application.dto';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InviteCandidateDto } from './dto/invite-candidate.dto';

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
        candidateId: dto.candidateId,
      },
    });

    if (existingApplication) {
      throw new BadRequestException(
        'Candidate has already applied to this job',
      );
    }

    const inviteToken = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return this.prisma.application.create({
      data: {
        organizationId,
        candidateId: dto.candidateId,
        jobPostingId: dto.jobPostingId,
        status: dto.status,
        inviteToken,
        tokenExpiresAt,
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
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  async inviteCandidate(organizationId: string, dto: InviteCandidateDto) {
    const jobPosting = await this.prisma.jobPosting.findFirst({
      where: {
        id: dto.jobPostingId,
        organizationId,
      },
      include: {
        pipelineVersion: true,
      },
    });

    if (!jobPosting) {
      throw new NotFoundException('Job posting not found');
    }

    if (jobPosting.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Candidate can only be invited to a published job',
      );
    }

    if (!jobPosting.pipelineVersionId || !jobPosting.pipelineVersion) {
      throw new BadRequestException(
        'Job posting does not have a published pipeline version',
      );
    }

    const existingApplication = await this.prisma.application.findFirst({
      where: {
        organizationId,
        jobPostingId: dto.jobPostingId,
        candidate: {
          email: dto.email,
        },
      },
    });

    if (existingApplication) {
      throw new BadRequestException(
        'Candidate has already been invited to this job',
      );
    }

    const inviteToken = randomBytes(32).toString('hex');

    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.create({
        data: {
          organizationId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
        },
      });

      const application = await tx.application.create({
        data: {
          organizationId,
          candidateId: candidate.id,
          jobPostingId: jobPosting.id,
          inviteToken,
          tokenExpiresAt,
          status: 'INVITED',
        },
        include: {
          candidate: true,
          jobPosting: true,
        },
      });

      return application;
    });

    return result;
  }
}
