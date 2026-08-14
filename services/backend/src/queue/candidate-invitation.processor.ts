import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CandidateInvitationJobData } from './candidate-invitation.queue';

@Processor('candidate-invitation')
export class CandidateInvitationProcessor extends WorkerHost {
  process(job: Job<CandidateInvitationJobData>): Promise<void> {
    const data = job.data;

    console.log('📩 Processing candidate invitation:', {
      jobId: job.id,
      applicationId: data.applicationId,
      candidateEmail: data.candidateEmail,
      candidateName: data.candidateName,
    });

    // Email provider will be added later.
    console.log(`📧 Invitation email would be sent to ${data.candidateEmail}`);
    return Promise.resolve();
  }
}
