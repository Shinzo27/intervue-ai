import { z } from 'zod';
import type { BackendClient } from '../../backend/client.js';
import type { McpToolDefinition, ToolContext } from '../registry.js';

/**
 * Pipeline MCP — read-only tools exposing the frozen interview structure
 * (pipeline snapshot → stage versions → question versions → rubrics).
 * The AI receives business capabilities, never database access.
 */
export function buildPipelineTools(client: BackendClient): McpToolDefinition[] {
  return [
    {
      name: 'get_current_interview_state',
      description:
        'Get the full current state of an interview: session status, current stage, the current question ' +
        'with its options and rubric criteria, plus progress counters. The pipeline snapshot is the source ' +
        'of truth — never invent questions or stages.',
      inputSchema: {
        interviewId: z.string().uuid().describe('InterviewSession id (UUID)'),
      },
      permissions: ['pipeline:read'],
      readOnly: true,
      handler: async (input: Record<string, unknown>, ctx: ToolContext) =>
        client.getInterviewState(input.interviewId as string, ctx.traceId),
    },
    {
      name: 'get_current_question',
      description:
        'Get the exact question the candidate must answer next, verbatim, with its options. ' +
        'Ask this question word-for-word; do not paraphrase or invent variants.',
      inputSchema: {
        interviewId: z.string().uuid().describe('InterviewSession id (UUID)'),
      },
      permissions: ['pipeline:read'],
      readOnly: true,
      handler: async (input: Record<string, unknown>, ctx: ToolContext) =>
        client.getCurrentQuestion(input.interviewId as string, ctx.traceId),
    },
    {
      name: 'get_stage_questions',
      description:
        'List all questions of a stage version, in order. Use to orient within a stage or to ' +
        'preview what remains. The stageVersionId must belong to this interview.',
      inputSchema: {
        interviewId: z.string().uuid().describe('InterviewSession id (UUID)'),
        stageVersionId: z
          .string()
          .min(5)
          .describe('PipelineStageVersion id (server-generated cuid, from state/progress)'),
      },
      permissions: ['pipeline:read'],
      readOnly: true,
      handler: async (input: Record<string, unknown>, ctx: ToolContext) =>
        client.getStageQuestions(
          input.interviewId as string,
          input.stageVersionId as string,
          ctx.traceId,
        ),
    },
    {
      name: 'get_question_details',
      description:
        'Get full details of a question version including its rubric criteria — the scoring ' +
        'context for evaluating an answer. The questionVersionId must belong to this interview.',
      inputSchema: {
        interviewId: z.string().uuid().describe('InterviewSession id (UUID)'),
        questionVersionId: z
          .string()
          .min(5)
          .describe('QuestionVersion id (server-generated cuid)'),
      },
      permissions: ['pipeline:read'],
      readOnly: true,
      handler: async (input: Record<string, unknown>, ctx: ToolContext) =>
        client.getQuestionDetails(
          input.interviewId as string,
          input.questionVersionId as string,
          ctx.traceId,
        ),
    },
    {
      name: 'get_interview_progress',
      description:
        'Get interview progress: stage-by-stage runtime map with statuses, which stage is current, ' +
        'and answered/total question counters.',
      inputSchema: {
        interviewId: z.string().uuid().describe('InterviewSession id (UUID)'),
      },
      permissions: ['pipeline:read'],
      readOnly: true,
      handler: async (input: Record<string, unknown>, ctx: ToolContext) =>
        client.getInterviewProgress(input.interviewId as string, ctx.traceId),
    },
  ];
}
