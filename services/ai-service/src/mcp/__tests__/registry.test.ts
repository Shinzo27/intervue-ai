import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { ToolRegistry } from '../registry.js';
import { buildPipelineTools } from '../pipeline/pipeline.tools.js';
import { BackendError } from '../../backend/client.js';
import { z } from 'zod';

/** Minimal BackendClient double: only the methods tools call. */
function fakeClient(overrides: Partial<Record<string, never>> = {}) {
  return {
    getInterviewState: mock.fn(async () => ({ interview: { id: 'i1' } })),
    ...overrides,
  } as never as Parameters<typeof buildPipelineTools>[0];
}

describe('ToolRegistry', () => {
  it('registers tools and rejects duplicates', () => {
    const registry = new ToolRegistry();
    const tool = {
      name: 't1',
      description: 'd',
      inputSchema: { id: z.string() },
      permissions: ['p'],
      handler: async () => ({}),
    };
    registry.register(tool);
    assert.throws(() => registry.register({ ...tool }), /already registered/);
    assert.equal(registry.list().length, 1);
  });

  it('wraps handler success into structured text content', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'echo',
      description: 'd',
      inputSchema: { value: z.string() },
      permissions: [],
      handler: async (input) => ({ echoed: (input as { value: string }).value }),
    });

    const handler = registry.toSdkHandler(registry.get('echo')!);
    const response = await handler({ value: 'hello' });

    assert.equal(response.isError, undefined);
    const payload = JSON.parse(response.content[0].text);
    assert.equal(payload.ok, true);
    assert.equal(payload.result.echoed, 'hello');
    assert.match(payload.traceId, /-[0-9a-f]/i);
  });

  it('maps BackendError into a typed, actionable error result', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'boom',
      description: 'd',
      inputSchema: {},
      permissions: [],
      handler: async () => {
        throw new BackendError('Interview session not found', 404, 'trace-1');
      },
    });

    const handler = registry.toSdkHandler(registry.get('boom')!);
    const response = await handler({});

    assert.equal(response.isError, true);
    const payload = JSON.parse(response.content[0].text);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.kind, 'backend_error');
    assert.equal(payload.error.status, 404);
    assert.match(String(payload.error.hint), /not found/i);
  });

  it('maps unexpected errors without leaking internals', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'crash',
      description: 'd',
      inputSchema: {},
      permissions: [],
      handler: async () => {
        throw new Error('secret internal detail');
      },
    });

    const response = await registry.toSdkHandler(registry.get('crash')!)({});
    const payload = JSON.parse(response.content[0].text);
    assert.equal(payload.error.kind, 'unexpected_error');
  });
});

describe('pipeline tools', () => {
  it('get_current_interview_state calls the backend with a trace id', async () => {
    const client = fakeClient();
    const [tool] = buildPipelineTools(client);
    await tool.handler({ interviewId: '00000000-0000-4000-8000-000000000001' } as never, {
      traceId: 'trace-42',
    });
    const calls = (client as never as {
      getInterviewState: { mock: { calls: { arguments: unknown[] }[] } };
    }).getInterviewState.mock.calls;
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].arguments, [
      '00000000-0000-4000-8000-000000000001',
      'trace-42',
    ]);
  });

  it('declares read-only permission and a uuid-validated input', () => {
    const [tool] = buildPipelineTools(fakeClient());
    assert.equal(tool.readOnly, true);
    assert.deepEqual(tool.permissions, ['pipeline:read']);
    const parsed = z.object(tool.inputSchema).safeParse({ interviewId: 'nope' });
    assert.equal(parsed.success, false);
  });
});
