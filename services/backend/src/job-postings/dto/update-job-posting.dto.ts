import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateJobPostingDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  pipelineId?: string;
}
