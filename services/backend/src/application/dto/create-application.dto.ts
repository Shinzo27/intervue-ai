import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

export class CreateApplicationDto {
  @IsUUID()
  candidateId: string;

  @IsString()
  jobPostingId: string;

  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}
