import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { DecisionOutcome } from '@prisma/client';

export class CreateInternalDecisionDto {
  @IsEnum(DecisionOutcome)
  outcome: DecisionOutcome;

  @IsInt()
  @Min(0)
  totalScore: number;

  @IsInt()
  @Min(0)
  maxScore: number;

  /** Decision reasoning (AI recommendation narrative or human context). */
  @IsOptional()
  @IsString()
  reasoning?: string;

  /** Free-form actor context for the audit trail, e.g. { requestedBy: 'ai-service', model: 'gpt-4o-mini' }. */
  @IsOptional()
  @IsString()
  requestedBy?: string;
}
