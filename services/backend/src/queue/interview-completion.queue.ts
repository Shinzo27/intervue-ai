import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface InterviewCompletionJobData {
  interviewId: string;
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  /** Recruiter to notify (job owner). Absent → the job is skipped loudly. */
  recruiterEmail: string | null;
  totalScore: number | null;
  maxScore: number | null;
}

/**
 * Recruiter notification when an interview completes (master-note §45).
 * Enqueued by the backend at completion time; the worker resolves delivery
 * through the notification transport.
 */
@Injectable()
export class InterviewCompletionQueue {
  constructor(
    @InjectQueue('interview-completion')
    private readonly queue: Queue,
  ) {}

  async addCompletionJob(data: InterviewCompletionJobData) {
    return this.queue.add('notify-completion', data);
  }
}
