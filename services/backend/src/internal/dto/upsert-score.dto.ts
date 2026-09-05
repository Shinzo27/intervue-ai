import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertCriterionScoreDto {
  @IsString()
  @IsNotEmpty()
  rubricCriterionVersionId: string;

  @IsInt()
  @Min(0)
  score: number;

  @IsOptional()
  @IsString()
  reasoning?: string;
}

export class UpsertScoreDto {
  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @IsString()
  @IsNotEmpty()
  questionVersionId: string;

  @IsInt()
  @Min(0)
  overallScore: number;

  @IsInt()
  @Min(0)
  maxScore: number;

  @IsOptional()
  @IsString()
  reasoning?: string;

  /**
   * Criterion-level breakdown. Replaces any existing criterion scores for
   * this (application, questionVersion) score record inside one transaction.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpsertCriterionScoreDto)
  criteria?: UpsertCriterionScoreDto[];
}
