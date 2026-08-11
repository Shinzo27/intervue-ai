import { Injectable } from '@nestjs/common';
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
        phone: dto.phone,
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
    include: { applications: true };
  }> | null> {
    return this.prisma.candidate.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        applications: true,
      },
    });
  }
}
