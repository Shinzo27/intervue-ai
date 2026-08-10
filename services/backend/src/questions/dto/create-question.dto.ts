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

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsInt()
  @Min(1)
  order: number;

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}
