import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BackendClient } from '../backend/client.js';
import type { ScoringOrchestrator } from '../scoring/scoring.service.js';
import { ToolRegistry } from './registry.js';
import { buildPipelineTools } from './pipeline/pipeline.tools.js';
import { buildScoringTools } from './scoring/scoring.tools.js';
import { buildActionTools } from './action/action.tools.js';

export interface McpToolContext {
  client: BackendClient;
  orchestrator: ScoringOrchestrator;
}

/**
 * Builds an MCP server with the full toolset registered.
 * Transport-agnostic: the caller picks stdio or Streamable HTTP.
 */
export function createMcpServer({ client, orchestrator }: McpToolContext): {
  server: McpServer;
  registry: ToolRegistry;
} {
  const registry = new ToolRegistry();

  for (const tool of buildPipelineTools(client)) {
    registry.register(tool);
  }
  for (const tool of buildScoringTools(orchestrator)) {
    registry.register(tool);
  }
  for (const tool of buildActionTools(client)) {
    registry.register(tool);
  }

  const server = new McpServer(
    { name: 'intervue-ai-mcp', version: '0.1.0' },
    {
      instructions:
        'Intervue AI interview tools. The pipeline snapshot is the source of truth for interview ' +
        'structure. Read tools are safe. State-changing Action tools are permission-checked: ' +
        'they may advance and complete interviews and create AI recommendations, but they can ' +
        'never change a human decision or modify a published pipeline snapshot.',
    },
  );

  for (const tool of registry.list()) {
    server.registerTool(tool.name, {
      title: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: {
        readOnlyHint: tool.readOnly ?? false,
        openWorldHint: false,
      },
    }, registry.toSdkHandler(tool));
  }

  return { server, registry };
}
