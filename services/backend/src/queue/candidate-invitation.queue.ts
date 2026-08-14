import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class CandidateInvitationQueue {
  constructor(
    @InjectQueue('candidate-invitation')
    private readonly queue: Queue,
  ) {}

  async addInvitationJob(data: {
    applicationId: string;
    candidateEmail: string;
    candidateName: string;
    inviteToken: string;
  }) {
    return this.queue.add('send-invitation', data);
  }
}
