import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { AuditActorType } from '@prisma/client';

export class CreateAuditEventDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsEnum(AuditActorType)
  actorType: AuditActorType;

  /** Acting identity when known (user id, service name, agent run id, ...). */
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsNotEmpty()
  entityType: string;

  @IsString()
  @IsNotEmpty()
  entityId: string;

  /**
   * For AI actions this should capture tool name, model, request context,
   * result and reason — see docs/ai.md §4 (AI actor / audit model).
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
