import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadLlmEnv, loadEnv } from '../env.js';

/**
 * Provider configuration validation.
 *
 * These cross-checks exist to fail loudly at boot rather than mysteriously at
 * call time, so they are worth pinning: a bad model pairing produces two copies
 * of one opinion, which *looks* like model agreement and is worse than an error.
 */

const base = {
  BACKEND_INTERNAL_URL: 'http://localhost:3000/api/internal',
  BACKEND_INTERNAL_TOKEN: 'token',
} as NodeJS.ProcessEnv;

describe('loadLlmEnv', () => {
  it('defaults to the offline fake provider with no configuration', () => {
    const env = loadLlmEnv({} as NodeJS.ProcessEnv);
    assert.equal(env.LLM_PROVIDER, 'fake');
    assert.equal(env.LLM_SECONDARY_PROVIDER, 'none');
  });

  it('does not require backend settings (the harness is offline)', () => {
    // The eval harness only ever needs LLM config; demanding a backend URL it
    // would never call was the original coupling bug.
    const env = loadLlmEnv({ LLM_PROVIDER: 'fake' } as NodeJS.ProcessEnv);
    assert.equal(env.LLM_PROVIDER, 'fake');
  });

  it('requires the matching key for a real provider', () => {
    assert.throws(
      () => loadLlmEnv({ LLM_PROVIDER: 'groq' } as NodeJS.ProcessEnv),
      /requires GROQ_API_KEY/,
    );
    assert.throws(
      () => loadLlmEnv({ LLM_PROVIDER: 'openai' } as NodeJS.ProcessEnv),
      /requires OPENAI_API_KEY/,
    );
  });

  it('treats placeholder keys as absent rather than as credentials', () => {
    // The shipped .env contains short placeholders like `sk-...`; passing one to
    // a provider yields a confusing 401 instead of a clear "not configured".
    assert.throws(
      () =>
        loadLlmEnv({
          LLM_PROVIDER: 'groq',
          GROQ_API_KEY: 'gsk-...',
        } as NodeJS.ProcessEnv),
      /requires GROQ_API_KEY/,
    );
  });

  it('accepts a realistically-shaped key', () => {
    const env = loadLlmEnv({
      LLM_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk_' + 'a'.repeat(50),
    } as NodeJS.ProcessEnv);
    assert.equal(env.LLM_PROVIDER, 'groq');
  });

  it('allows two different models on the SAME provider', () => {
    // Single-key setups are common; model diversity is still real diversity.
    const env = loadLlmEnv({
      LLM_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk_' + 'a'.repeat(50),
      LLM_SECONDARY_PROVIDER: 'groq',
      LLM_SECONDARY_MODEL: 'other-model',
    } as NodeJS.ProcessEnv);
    assert.equal(env.LLM_SECONDARY_MODEL, 'other-model');
  });

  it('rejects the identical model twice', () => {
    // Two copies of one opinion looks like agreement while being none.
    assert.throws(
      () =>
        loadLlmEnv({
          LLM_PROVIDER: 'groq',
          GROQ_API_KEY: 'gsk_' + 'a'.repeat(50),
          GROQ_MODEL: 'same-model',
          LLM_SECONDARY_PROVIDER: 'groq',
          LLM_SECONDARY_MODEL: 'same-model',
        } as NodeJS.ProcessEnv),
      /two DIFFERENT models/,
    );
  });

  it('rejects the identical model twice via the default fallback', () => {
    // LLM_SECONDARY_MODEL unset falls back to GROQ_MODEL -> still identical.
    assert.throws(
      () =>
        loadLlmEnv({
          LLM_PROVIDER: 'groq',
          GROQ_API_KEY: 'gsk_' + 'a'.repeat(50),
          LLM_SECONDARY_PROVIDER: 'groq',
        } as NodeJS.ProcessEnv),
      /two DIFFERENT models/,
    );
  });

  it('requires a key for a secondary provider too', () => {
    assert.throws(
      () =>
        loadLlmEnv({
          LLM_PROVIDER: 'groq',
          GROQ_API_KEY: 'gsk_' + 'a'.repeat(50),
          LLM_SECONDARY_PROVIDER: 'openai',
          LLM_SECONDARY_MODEL: 'gpt-4o-mini',
        } as NodeJS.ProcessEnv),
      /requires the matching API key/,
    );
  });
});

describe('loadEnv', () => {
  it('still requires backend settings for the service', () => {
    assert.throws(
      () => loadEnv({ LLM_PROVIDER: 'fake' } as NodeJS.ProcessEnv),
      /Invalid ai-service environment/,
    );
  });

  it('applies the same provider cross-checks as loadLlmEnv', () => {
    assert.throws(
      () => loadEnv({ ...base, LLM_PROVIDER: 'groq' } as NodeJS.ProcessEnv),
      /requires GROQ_API_KEY/,
    );
  });

  it('loads a full valid configuration', () => {
    const env = loadEnv({ ...base, LLM_PROVIDER: 'fake' } as NodeJS.ProcessEnv);
    assert.equal(env.BACKEND_INTERNAL_URL, base.BACKEND_INTERNAL_URL);
    assert.equal(env.MCP_HTTP_PORT, 3100);
  });
});
