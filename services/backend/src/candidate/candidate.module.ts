import { Module } from '@nestjs/common';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CandidateTokenGuard } from '../auth/guards/candidate-token.guard';

@Module({
  imports: [PrismaModule],
  controllers: [CandidateController],
  providers: [CandidateService, CandidateTokenGuard],
})
export class CandidateModule {}
