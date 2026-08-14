import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { Candidate, Prisma } from '@prisma/client';

@Injectable()
export class CandidateService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, dto: CreateCandidateDto): Promise<Candidate> {
    return this.prisma.candidate.create({
      data: {
        organizationId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
      },
    });
  }

  findAll(organizationId: string): Promise<Candidate[]> {
    return this.prisma.candidate.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(
    organizationId: string,
    id: string,
  ): Promise<Prisma.CandidateGetPayload<{
    include: { application: true };
  }> | null> {
    return this.prisma.candidate.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        application: true,
      },
    });
  }

  async startApplication(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: {
        id: applicationId,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'INVITED') {
      throw new BadRequestException('Application has already been started');
    }

    return this.prisma.application.update({
      where: {
        id: applicationId,
      },
      data: {
        status: 'STARTED',
        startedAt: new Date(),
      },
    });
  }
}
