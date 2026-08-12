import { IsEmail, IsOptional, IsString } from 'class-validator';

export class InviteCandidateDto {
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEmail()
  email: string;

  @IsString()
  jobPostingId: string;
}
