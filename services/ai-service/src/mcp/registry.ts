import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BackendError } from '../backend/client.js';

/** Context passed to every tool handler invocation. */
export interface ToolContext {
  traceId: string;
}

/**
 * MCP tool definition. Handlers receive SDK-validated arguments (validated
 * against inputSchema by the MCP server before the handler runs) as a plain
 * record; each tool casts the fields it declared.
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  /** Zod raw shape — the MCP SDK validates args against this. */
  inputSchema: z.ZodRawShape;
  /** Capability tags (for the permission matrix / docs). */
  permissions: string[];
  readOnly?: boolean;
  handler: (
    input: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<unknown>;
}

/**
 * Registry of MCP tools. Tools are defined once and wired to any transport
 * via the MCP SDK's registerTool. Handlers never see transport concerns:
 * they receive validated, typed input and a trace context.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, McpToolDefinition>();

  register(tool: McpToolDefinition): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): McpToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): McpToolDefinition[] {
    return [...this.tools.values()];
  }

  /**
   * Wraps a handler into the SDK callback shape: validated args in,
   * structured JSON text out, typed error mapping (no silent failures).
   */
  toSdkHandler(tool: McpToolDefinition) {
    return async (args: unknown) => {
      const context: ToolContext = { traceId: randomUUID() };
      try {
        const result = await tool.handler(
          (args ?? {}) as Record<string, unknown>,
          context,
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { ok: true, traceId: context.traceId, result },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true as const,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ok: false,
                  traceId: context.traceId,
                  error: describeError(error),
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    };
  }
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof BackendError) {
    return {
      kind: 'backend_error',
      status: error.status,
      message: error.message,
      hint: hintForStatus(error.status),
      traceId: error.traceId,
    };
  }
  return {
    kind: 'unexpected_error',
    message: error instanceof Error ? error.message : String(error),
  };
}

function hintForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid id or illegal state transition for this interview.';
    case 401:
      return 'Internal service token rejected — check BACKEND_INTERNAL_TOKEN.';
    case 403:
      return 'Action not permitted for the AI actor.';
    case 404:
      return 'Resource not found for the given id.';
    default:
      return status >= 500
        ? 'Backend failure — safe to retry (idempotent read).'
        : 'Unexpected backend response.';
  }
}
