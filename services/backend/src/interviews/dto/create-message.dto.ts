import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { MessageRole } from '@prisma/client';

export class CreateMessageDto {
  @IsEnum(MessageRole)
  role: MessageRole;

  @IsString()
  @IsNotEmpty()
  content: string;
}
