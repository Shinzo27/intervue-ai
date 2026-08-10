import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateQuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  text?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  order?: number;
}
