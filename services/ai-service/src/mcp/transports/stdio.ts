import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * stdio transport — local agents, Claude Desktop, and dev tooling talk to
 * the MCP server over stdin/stdout. Nothing but JSON-RPC may ever be
 * written to stdout; service logs go to stderr.
 */
export async function startStdioTransport(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp] stdio transport connected');
}
