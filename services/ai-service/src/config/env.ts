import { z } from 'zod';

/**
 * Fail-fast environment validation. The service must not boot with a
 * half-configured surface: missing backend token or URL means every MCP
 * tool would fail at call time instead of loudly at startup.
 */

/**
 * LLM provider configuration, factored out from the backend/MCP settings.
 *
 * The offline eval harness (evals/run.ts) needs ONLY these fields and never
 * talks to the backend, so it can load them without being forced to supply a
 * backend URL it would not use.
 */
export const llmEnvSchema = z.object({
  // LLM_PROVIDER selects the active adapter: fake | openai | groq.
  LLM_PROVIDER: z.enum(['fake', 'openai', 'groq']).default('fake'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  GROQ_API_KEY: z.string().min(1).optional(),
  // NOTE: Groq model availability is per-account. `llama-3.1-8b-instant` is NOT
  // available on every account (it 404s as model_not_found on some); gpt-oss-120b
  // is a current production model. Always confirm against GET /openai/v1/models.
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),

  // Two-model scoring: the secondary provider for cross-checking. Requires
  // its key to be present when enabled.
  LLM_SECONDARY_PROVIDER: z.enum(['none', 'openai', 'groq']).default('none'),
  LLM_SECONDARY_MODEL: z.string().optional(),
});

export type LlmEnv = z.infer<typeof llmEnvSchema>;

const envSchema = llmEnvSchema.extend({
  BACKEND_INTERNAL_URL: z.string().url(),
  BACKEND_INTERNAL_TOKEN: z.string().min(1),

  MCP_HTTP_HOST: z.string().default('127.0.0.1'),
  MCP_HTTP_PORT: z.coerce.number().int().positive().default(3100),

  // Optional bearer token protecting the HTTP transport. When unset the
  // transport binds without auth (dev without auth) and logs a warning.
  MCP_HTTP_TOKEN: z.string().min(1).optional(),

  NODE_ENV: z.string().default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Provider-key cross-checks, shared by both loaders so the full service and the
 * offline harness can never disagree about what a valid provider config is.
 */
function assertProviderConfig(env: LlmEnv): void {
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
    // Two models must actually differ. Same provider with a DIFFERENT model is
    // allowed — that is genuine model diversity and is the only option when a
    // single key is available — but the identical model twice would produce two
    // copies of one opinion, which is worse than useless because it *looks*
    // like agreement.
    const primaryModel =
      env.LLM_PROVIDER === 'openai' ? env.OPENAI_MODEL : env.GROQ_MODEL;
    const secondaryModel =
      env.LLM_SECONDARY_MODEL ??
      (env.LLM_SECONDARY_PROVIDER === 'openai' ? env.OPENAI_MODEL : env.GROQ_MODEL);

    if (secondaryModel === primaryModel) {
      throw new Error(
        'Two-model scoring requires two DIFFERENT models: ' +
          `primary and secondary both resolve to "${primaryModel}".`,
      );
    }
  }
}

/**
 * LLM-only configuration for offline tools (the eval harness). Never throws on
 * missing backend settings, because those are genuinely not needed.
 *
 * A placeholder key is treated as absent: the shipped .env contains
 * `OPENAI_API_KEY=sk-...` style placeholders, and treating "sk-..." as a real
 * credential would produce confusing provider errors at call time instead of a
 * clear "no key configured" at boot.
 */
export function loadLlmEnv(source: NodeJS.ProcessEnv = process.env): LlmEnv {
  const cleaned: NodeJS.ProcessEnv = { ...source };
  for (const key of ['OPENAI_API_KEY', 'GROQ_API_KEY'] as const) {
    const value = cleaned[key];
    if (value && !isUsableKey(value)) {
      delete cleaned[key];
    }
  }

  const parsed = llmEnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid LLM environment:\n${issues}`);
  }

  assertProviderConfig(parsed.data);
  return parsed.data;
}

/** Reject obvious placeholders so "no key" is reported as such, not as a 401. */
function isUsableKey(value: string): boolean {
  const v = value.trim();
  if (v.length < 20) return false;
  if (/^<.*>$/.test(v)) return false;
  if (/your[-_ ]?key|placeholder|changeme|xxx|\.\.\./i.test(v)) return false;
  return true;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Compose passes unset keys as empty strings (`${OPENAI_API_KEY:-}`); treat
  // blank as absent so the offline `fake` provider boots without any keys.
  const cleaned: NodeJS.ProcessEnv = { ...source };
  for (const key of ['OPENAI_API_KEY', 'GROQ_API_KEY', 'MCP_HTTP_TOKEN'] as const) {
    if (cleaned[key] !== undefined && cleaned[key]!.trim() === '') {
      delete cleaned[key];
    }
  }

  const parsed = envSchema.safeParse(cleaned);

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
  assertProviderConfig(env);

  return env;
}
