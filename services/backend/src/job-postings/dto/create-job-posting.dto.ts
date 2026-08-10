import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateJobPostingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  pipelineId?: string;
}
