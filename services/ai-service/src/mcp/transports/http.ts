import type { Server } from 'node:http';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '../../config/env.js';

/**
 * Streamable HTTP transport (stateless mode) — serves the MCP runtime and
 * external agent demos. Optional bearer-token auth protects the endpoint.
 *
 * Stateless pattern: a fresh transport per request (initialize state lives
 * on the transport; sessions are not persisted).
 */
export function startHttpTransport(
  server: McpServer,
  env: Env,
): Promise<Server> {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  // Health probe is unauthenticated (container healthchecks).
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'intervue-ai-mcp', transport: 'http' });
  });

  // Bearer auth (skip when no token configured — dev only).
  app.use((req, res, next) => {
    if (!env.MCP_HTTP_TOKEN) {
      console.warn('[mcp] MCP_HTTP_TOKEN not set — HTTP transport is open');
      return next();
    }
    const header = req.headers.authorization;
    if (header !== `Bearer ${env.MCP_HTTP_TOKEN}`) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized' },
        id: null,
      });
      return;
    }
    next();
  });

  app.post('/mcp', async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', () => {
        transport.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'GET not supported in stateless mode' },
      id: null,
    });
  });

  return new Promise((resolve, reject) => {
    const httpServer = app.listen(env.MCP_HTTP_PORT, env.MCP_HTTP_HOST, () => {
      console.log(
        `[mcp] HTTP transport listening on http://${env.MCP_HTTP_HOST}:${env.MCP_HTTP_PORT}/mcp`,
      );
      resolve(httpServer);
    });
    httpServer.on('error', reject);
  });
}
