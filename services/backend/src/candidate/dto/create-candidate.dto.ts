import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEmail()
  email: string;
}
