import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { InternalService } from './internal.service';
import { PrismaModule } from '../prisma/prisma.module';
import { InterviewsModule } from '../interviews/interviews.module';

/**
 * Service-to-service capability surface for ai-service (MCP tools).
 * Reuses InterviewsService so the answer-progression state machine has a
 * single implementation.
 */
@Module({
  imports: [PrismaModule, InterviewsModule],
  controllers: [InternalController],
  providers: [InternalServiceGuard, InternalService],
})
export class InternalModule {}
