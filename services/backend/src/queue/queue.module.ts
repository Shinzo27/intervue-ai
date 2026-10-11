import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CandidateInvitationQueue } from './candidate-invitation.queue';
import { CandidateInvitationProcessor } from './candidate-invitation.processor';
import { InterviewCompletionQueue } from './interview-completion.queue';
import { InterviewCompletionProcessor } from './interview-completion.processor';
import { InterviewNotificationsService } from './interview-notifications.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    NotificationsModule,
    PrismaModule,

    BullModule.forRoot({
      // Env-driven so the same image works locally and in docker compose
      // (where Redis is a sibling service, not localhost).
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),

    BullModule.registerQueue({ name: 'candidate-invitation' }),
    BullModule.registerQueue({ name: 'interview-completion' }),
  ],

  providers: [
    CandidateInvitationQueue,
    CandidateInvitationProcessor,
    InterviewCompletionQueue,
    InterviewCompletionProcessor,
    InterviewNotificationsService,
  ],

  exports: [
    CandidateInvitationQueue,
    InterviewCompletionQueue,
    InterviewNotificationsService,
  ],
})
export class QueueModule {}
