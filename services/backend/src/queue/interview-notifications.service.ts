import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InterviewCompletionQueue } from './interview-completion.queue';

/**
 * Bridges interview completion → recruiter notification.
 *
 * Lives in the queue module (it needs both Prisma and the queue) so the
 * queue module does not have to import InterviewsModule — that direction
 * would create a cycle.
 *
 * Notification is best-effort: the interview is already complete and
 * persisted, so a queue/email outage must never surface as a failed answer
 * submission. Failures are logged, not thrown.
 */
@Injectable()
export class InterviewNotificationsService {
  private readonly logger = new Logger(InterviewNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly completionQueue: InterviewCompletionQueue,
  ) {}

  async notifyCompletion(
    interviewId: string,
    applicationId: string,
  ): Promise<void> {
    try {
      const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          candidate: true,
          jobPosting: { include: { createdBy: { select: { email: true } } } },
          scores: { select: { overallScore: true, maxScore: true } },
        },
      });

      if (!application) return;

      const scored = application.scores.length > 0;

      await this.completionQueue.addCompletionJob({
        interviewId,
        applicationId,
        candidateName: `${application.candidate.firstName} ${application.candidate.lastName}`.trim(),
        jobTitle: application.jobPosting.title,
        recruiterEmail: application.jobPosting.createdBy?.email ?? null,
        totalScore: scored
          ? application.scores.reduce((sum, s) => sum + s.overallScore, 0)
          : null,
        maxScore: scored
          ? application.scores.reduce((sum, s) => sum + s.maxScore, 0)
          : null,
      });
    } catch (error) {
      this.logger.warn(
        `Interview ${interviewId} completed but the notification could not be queued: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
