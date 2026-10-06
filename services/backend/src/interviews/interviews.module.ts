import { Module } from '@nestjs/common';
import { InterviewsController } from './interviews.controller';
import { CandidateInterviewController } from './candidate-interview.controller';
import { InterviewsService } from './interviews.service';
import { CandidateTokenGuard } from './guards/candidate-token.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InterviewsController, CandidateInterviewController],
  providers: [InterviewsService, CandidateTokenGuard],
  exports: [InterviewsService],
})
export class InterviewsModule {}
