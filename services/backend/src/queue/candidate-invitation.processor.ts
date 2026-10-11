import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CandidateInvitationJobData } from './candidate-invitation.queue';
import {
  candidatePortalUrl,
  type NotificationTransport,
} from '../notifications/notification-transport';
import { NOTIFICATION_TRANSPORT } from '../notifications/notifications.module';

@Processor('candidate-invitation')
export class CandidateInvitationProcessor extends WorkerHost {
  constructor(
    @Inject(NOTIFICATION_TRANSPORT)
    private readonly transport: NotificationTransport,
  ) {
    super();
  }

  async process(job: Job<CandidateInvitationJobData>): Promise<void> {
    const data = job.data;
    const link = `${candidatePortalUrl()}/interview/${data.inviteToken}`;

    await this.transport.send({
      to: data.candidateEmail,
      subject: 'Your interview invitation',
      text:
        `Hi ${data.candidateName},\n\n` +
        `You have been invited to an AI-conducted interview. ` +
        `No account is needed — open your personal link to begin:\n\n${link}\n\n` +
        `You can stop and come back later; the link keeps your progress.`,
      meta: {
        applicationId: data.applicationId,
        transport: this.transport.name,
      },
    });
  }
}
