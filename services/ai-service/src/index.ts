import 'dotenv/config';
import { loadEnv } from './config/env.js';
import { BackendClient } from './backend/client.js';
import { buildPrimaryProvider, buildSecondaryProvider } from './llm/factory.js';
import { buildChatProvider } from './llm/chat-factory.js';
import { ScoringOrchestrator } from './scoring/scoring.service.js';
import { InterviewerAgent } from './ai/interviewer/agent.js';
import { createInterviewRouter } from './ai/interviewer/http.js';
import { createMcpServer } from './mcp/server.js';
import { startHttpTransport } from './mcp/transports/http.js';
import { startStdioTransport } from './mcp/transports/stdio.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const client = new BackendClient({
    baseUrl: env.BACKEND_INTERNAL_URL,
    token: env.BACKEND_INTERNAL_TOKEN,
  });

  const primary = buildPrimaryProvider(env);
  const secondary = buildSecondaryProvider(env);
  const chat = buildChatProvider(env);
  console.error(
    `[mcp] llm: primary=${primary.name}:${primary.model}` +
      (secondary ? ` secondary=${secondary.name}:${secondary.model}` : ' (single-model)') +
      ` chat=${chat.name}:${chat.model}`,
  );

  const orchestrator = new ScoringOrchestrator(client, primary, secondary);
  const interviewer = new InterviewerAgent({ client, orchestrator, chat });

  const { server, registry } = createMcpServer({ client, orchestrator });

  const mode = process.argv[2] ?? 'http';

  if (mode === 'stdio') {
    await startStdioTransport(server);
    // stdio keeps the process alive on its own; nothing more to do.
    return;
  }

  if (mode === 'http') {
    await startHttpTransport(server, env, createInterviewRouter(interviewer));
    console.error(`[mcp] tools registered: ${registry.list().map((t) => t.name).join(', ')}`);
    console.error('[mcp] interviewer routes: POST /interviews/:id/chat[/stream]');
    return;
  }

  throw new Error(`Unknown transport mode: ${mode} (use: http | stdio)`);
}

bootstrap().catch((error) => {
  console.error('[mcp] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});