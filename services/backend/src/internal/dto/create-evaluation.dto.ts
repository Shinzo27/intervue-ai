import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateEvaluationDto {
  @IsString()
  @IsNotEmpty()
  interviewSessionId: string;

  @IsString()
  @IsNotEmpty()
  answerId: string;

  /**
   * Model identifier, e.g. "openai/gpt-4o-mini" or "groq/llama-3.3-70b".
   * Supports the two-model scoring architecture (one evaluation per model).
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  model?: string;
}
