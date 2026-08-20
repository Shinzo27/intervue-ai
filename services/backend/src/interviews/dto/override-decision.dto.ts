import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DecisionOutcome } from '@prisma/client';

export class OverrideDecisionDto {
  @IsEnum(DecisionOutcome)
  newOutcome: DecisionOutcome;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
