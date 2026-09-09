import { z } from 'zod';

/**
 * Fail-fast environment validation. The service must not boot with a
 * half-configured surface: missing backend token or URL means every MCP
 * tool would fail at call time instead of loudly at startup.
 */
const envSchema = z.object({
  BACKEND_INTERNAL_URL: z.string().url(),
  BACKEND_INTERNAL_TOKEN: z.string().min(1),

  MCP_HTTP_HOST: z.string().default('127.0.0.1'),
  MCP_HTTP_PORT: z.coerce.number().int().positive().default(3100),

  // Optional bearer token protecting the HTTP transport. When unset the
  // transport binds without auth (dev without auth) and logs a warning.
  MCP_HTTP_TOKEN: z.string().min(1).optional(),

  // --- LLM providers -----------------------------------------------------
  // LLM_PROVIDER selects the active adapter: fake | openai | groq.
  LLM_PROVIDER: z.enum(['fake', 'openai', 'groq']).default('fake'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),

  // Two-model scoring: the secondary provider for cross-checking. Requires
  // its key to be present when enabled.
  LLM_SECONDARY_PROVIDER: z.enum(['none', 'openai', 'groq']).default('none'),
  LLM_SECONDARY_MODEL: z.string().optional(),

  NODE_ENV: z.string().default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid ai-service environment:\n${issues}\n` +
        `Copy services/ai-service/.env.example to .env and fill it in.`,
    );
  }

  const env = parsed.data;

  // Provider-key cross-checks
  if (env.LLM_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    throw new Error('LLM_PROVIDER=openai requires OPENAI_API_KEY');
  }
  if (env.LLM_PROVIDER === 'groq' && !env.GROQ_API_KEY) {
    throw new Error('LLM_PROVIDER=groq requires GROQ_API_KEY');
  }
  if (env.LLM_SECONDARY_PROVIDER !== 'none') {
    const key =
      env.LLM_SECONDARY_PROVIDER === 'openai'
        ? env.OPENAI_API_KEY
        : env.GROQ_API_KEY;
    if (!key) {
      throw new Error(
        `LLM_SECONDARY_PROVIDER=${env.LLM_SECONDARY_PROVIDER} requires the matching API key`,
      );
    }
    if (env.LLM_SECONDARY_PROVIDER === env.LLM_PROVIDER) {
      throw new Error(
        'Two-model scoring requires two DIFFERENT providers (e.g. primary openai, secondary groq)',
      );
    }
  }

  return env;
}
