import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePipelineDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
