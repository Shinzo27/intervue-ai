import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { MessageRole } from '@prisma/client';

export class CreateInternalMessageDto {
  @IsEnum(MessageRole)
  role: MessageRole;

  @IsString()
  @IsNotEmpty()
  content: string;

  /**
   * Optional structured AI/runtime metadata (tool name, model, run id, ...).
   * Stored verbatim on the Message row.
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
