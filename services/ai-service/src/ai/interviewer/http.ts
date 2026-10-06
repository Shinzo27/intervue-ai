import { randomUUID } from 'node:crypto';
import express, { type Request, type Response, type Router } from 'express';
import type { InterviewerAgent } from './agent.js';

/**
 * Candidate-facing HTTP surface for the conversational interviewer
 * (master-note §39 §5.3).
 *
 * NOT the MCP transport and NOT on the MCP port: the candidate portal talks to
 * this, so it is mounted as a small Express router alongside the Streamable
 * HTTP MCP endpoint but under its own path, and it is auth-free in the same
 * way the MCP endpoint is — the interviewId is the capability, exactly like the
 * MCP HTTP transport's bearer token model. Phase 9 will put candidate-token
 * verification in front of it.
 */

/** SSE frames. `type` lets the portal render progress without parsing text. */
type StreamEvent =
  | { type: 'start'; interviewId: string }
  | { type: 'token'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; result: unknown }
  | { type: 'error'; message: string };

export function createInterviewRouter(agent: InterviewerAgent): Router {
  const router = express.Router();

  /**
   * POST /interviews/:id/start — opening turn. Idempotent: on an interview
   * that already has a conversation, the agent re-asks the current question
   * rather than restarting, so a page reload never loses progress.
   */
  router.post('/interviews/:id/start', async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const interviewId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!interviewId) {
      res.status(400).json({ ok: false, error: 'interviewId is required' });
      return;
    }

    try {
      const result = await agent.start(interviewId, randomUUID());
      res.json({ ok: true, traceId: randomUUID(), result });
    } catch (error) {
      const candidate = (error as { status?: number })?.status;
      const status =
        typeof candidate === 'number' && candidate >= 400 && candidate <= 599
          ? candidate
          : 502;
      res.status(status).json({
        ok: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  /**
   * POST /interviews/:id/chat — non-streaming turn. Simplest contract for the
   * portal and the one the e2e suite exercises.
   */
  router.post('/interviews/:id/chat', async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const interviewId = Array.isArray(rawId) ? rawId[0] : rawId;
    const content = typeof req.body?.content === 'string' ? req.body.content : '';

    if (!interviewId) {
      res.status(400).json({ ok: false, error: 'interviewId is required' });
      return;
    }
    if (!content.trim()) {
      res.status(400).json({ ok: false, error: 'content is required' });
      return;
    }

    try {
      const result = await agent.handleCandidateMessage(
        interviewId,
        content.trim(),
        randomUUID(),
      );
      res.json({ ok: true, traceId: randomUUID(), result });
    } catch (error) {
      // BackendError.status is 0 for transport failures (no HTTP response
      // reached us) and Express rejects anything outside 100-999. Only trust a
      // real HTTP status; otherwise surface it as 502 Bad Gateway.
      const candidate = (error as { status?: number })?.status;
      const status =
        typeof candidate === 'number' && candidate >= 400 && candidate <= 599
          ? candidate
          : 502;
      res.status(status).json({
        ok: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  /**
   * POST /interviews/:id/chat/stream — SSE turn.
   *
   * Frames: `start` → `delta`* → `done`. The agent currently produces its reply
   * in one call, so `delta` may arrive as a single chunk; the event contract is
   * what the portal renders against, and the shape stays valid when token-level
   * streaming is enabled on the provider later.
   */
  router.post('/interviews/:id/chat/stream', async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const interviewId = Array.isArray(rawId) ? rawId[0] : rawId;
    const content = typeof req.body?.content === 'string' ? req.body.content : '';

    if (!interviewId || !content.trim()) {
      res.status(400).json({ ok: false, error: 'interviewId and content are required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event: StreamEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      send({ type: 'start', interviewId });
      const result = await agent.handleCandidateMessage(
        interviewId,
        content.trim(),
        randomUUID(),
      );
      send({ type: 'delta', text: result.reply });
      send({ type: 'done', result });
    } catch (error) {
      send({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      res.end();
    }
  });

  return router;
}