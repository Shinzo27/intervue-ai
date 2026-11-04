import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Public } from '@thallesp/nestjs-better-auth';
import { InterviewsService } from './interviews.service';
import { CandidateTokenGuard } from './guards/candidate-token.guard';
import type { CandidateRequest } from './guards/candidate-token.guard';

/**
 * Candidate-facing interview routes (master-note §15, §49).
 *
 * Public because candidates have no account — the invite token is the
 * credential. `CandidateTokenGuard` resolves the token to exactly one
 * interview, so these routes never accept a caller-supplied interview id.
 */
@Controller('interviews/access')
@Public()
@UseGuards(CandidateTokenGuard)
export class CandidateInterviewController {
  constructor(private readonly interviewsService: InterviewsService) {}

  /** Interview state behind the token (job, candidate, status, current stage). */
  @Get(':token')
  async access(@Param('token') token: string) {
    return this.interviewsService.accessInterview(token);
  }

  /** Start the interview behind the token (NOT_STARTED → IN_PROGRESS). */
  @Post(':token/start')
  async start(@Req() request: CandidateRequest) {
    const context = request.candidateInterview;

    if (!context) {
      // Unreachable when the guard ran; kept so a future route edit that
      // drops the guard fails loudly instead of starting the wrong interview.
      throw new Error('Candidate interview context missing');
    }

    return this.interviewsService.startInterview(
      context.interviewId,
      context.organizationId,
    );
  }

  /**
   * The candidate's own conversation so far — used to restore the chat after
   * a refresh (master-note §49: progress is never lost). No internal
   * metadata, no scoring, no other candidate's data: the token scopes it.
   */
  @Get(':token/transcript')
  async transcript(@Req() request: CandidateRequest) {
    const context = request.candidateInterview;

    if (!context) {
      throw new Error('Candidate interview context missing');
    }

    return this.interviewsService.getCandidateTranscript(
      context.interviewId,
      context.organizationId,
    );
  }
}
