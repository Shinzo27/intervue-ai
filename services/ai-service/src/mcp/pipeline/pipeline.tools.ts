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
        interviewId: z
          .string()
          .uuid()
          .describe('InterviewSession id (UUID)'),
      },
      permissions: ['pipeline:read'],
      readOnly: true,
      handler: async (input: Record<string, unknown>, ctx: ToolContext) =>
        client.getInterviewState(input.interviewId as string, ctx.traceId),
    },
  ];
}
