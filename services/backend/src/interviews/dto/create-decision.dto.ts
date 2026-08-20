import { IsEnum } from 'class-validator';
import { DecisionOutcome } from '@prisma/client';

export class CreateDecisionDto {
  @IsEnum(DecisionOutcome)
  outcome: DecisionOutcome;
}
