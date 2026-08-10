import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { QuestionType } from '@prisma/client';

export class UpdateQuestionDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  question?: string;

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType;

  @IsInt()
  @Min(1)
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}
