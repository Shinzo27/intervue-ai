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
  // transport binds without auth (dev only) and logs a warning.
  MCP_HTTP_TOKEN: z.string().min(1).optional(),

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

  return parsed.data;
}
