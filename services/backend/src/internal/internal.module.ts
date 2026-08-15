import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InternalController],
  providers: [InternalServiceGuard],
})
export class InternalModule {}
