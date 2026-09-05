import { IsObject, IsOptional, IsString } from 'class-validator';

export class FailEvaluationDto {
  @IsOptional()
  @IsString()
  error?: string;

  /** Optional failure metadata (attempt count, provider error payload, ...). */
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;
}
