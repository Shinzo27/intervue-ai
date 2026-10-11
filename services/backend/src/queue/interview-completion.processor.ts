import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import type { InterviewCompletionJobData } from './interview-completion.queue';
import { type NotificationTransport } from '../notifications/notification-transport';
import { NOTIFICATION_TRANSPORT } from '../notifications/notifications.module';

@Processor('interview-completion')
export class InterviewCompletionProcessor extends WorkerHost {
  constructor(
    @Inject(NOTIFICATION_TRANSPORT)
    private readonly transport: NotificationTransport,
  ) {
    super();
  }

  async process(job: Job<InterviewCompletionJobData>): Promise<void> {
    const data = job.data;

    if (!data.recruiterEmail) {
      // No owner to notify — log rather than silently swallow the event.
      console.log(
        `📩 Interview ${data.interviewId} completed but the job has no owner email`,
      );
      return;
    }

    const scoreLine =
      data.totalScore !== null && data.maxScore !== null
        ? `\nScore: ${data.totalScore}/${data.maxScore}`
        : '\nScore: not yet computed (scoring may still be running)';

    const dashboardUrl = process.env.RECRUITER_DASHBOARD_URL ?? 'http://localhost:3002';

    await this.transport.send({
      to: data.recruiterEmail,
      subject: `Interview completed — ${data.candidateName} (${data.jobTitle})`,
      text:
        `${data.candidateName} finished the AI interview for "${data.jobTitle}".` +
        `${scoreLine}\n\n` +
        `Review the full evaluation: ${dashboardUrl}/applications/${data.applicationId}`,
      meta: {
        interviewId: data.interviewId,
        applicationId: data.applicationId,
        transport: this.transport.name,
      },
    });
  }
}
