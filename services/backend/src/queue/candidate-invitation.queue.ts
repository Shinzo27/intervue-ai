import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface CandidateInvitationJobData {
  applicationId: string;
  candidateEmail: string;
  candidateName: string;
  inviteToken: string;
}

@Injectable()
export class CandidateInvitationQueue {
  constructor(
    @InjectQueue('candidate-invitation')
    private readonly queue: Queue,
  ) {}

  async addInvitationJob(data: CandidateInvitationJobData) {
    return this.queue.add('send-invitation', data);
  }
}
