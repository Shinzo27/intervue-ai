import 'dotenv/config';
import { loadEnv } from './config/env.js';
import { BackendClient } from './backend/client.js';
import { createMcpServer } from './mcp/server.js';
import { startHttpTransport } from './mcp/transports/http.js';
import { startStdioTransport } from './mcp/transports/stdio.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const client = new BackendClient({
    baseUrl: env.BACKEND_INTERNAL_URL,
    token: env.BACKEND_INTERNAL_TOKEN,
  });

  const { server, registry } = createMcpServer({ client });

  const mode = process.argv[2] ?? 'http';

  if (mode === 'stdio') {
    await startStdioTransport(server);
    // stdio keeps the process alive on its own; nothing more to do.
    return;
  }

  if (mode === 'http') {
    await startHttpTransport(server, env);
    console.error(`[mcp] tools registered: ${registry.list().map((t) => t.name).join(', ')}`);
    return;
  }

  throw new Error(`Unknown transport mode: ${mode} (use: http | stdio)`);
}

bootstrap().catch((error) => {
  console.error('[mcp] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
