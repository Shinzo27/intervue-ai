import { IsUUID } from 'class-validator';

export class CreateInterviewDto {
  @IsUUID()
  applicationId: string;
}
