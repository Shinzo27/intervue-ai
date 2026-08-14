import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CandidateInvitationQueue } from './candidate-invitation.queue';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),

    BullModule.registerQueue({
      name: 'candidate-invitation',
    }),
  ],

  providers: [CandidateInvitationQueue],

  exports: [CandidateInvitationQueue],
})
export class QueueModule {}
