import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CompleteEvaluationDto {
  /** Final evaluation score (stored as Decimal(5,2)). */
  @IsNumber()
  score: number;

  @IsOptional()
  @IsString()
  reasoning?: string;

  /** Structured LLM result (criterion breakdown, confidence, usage, ...). */
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;
}
