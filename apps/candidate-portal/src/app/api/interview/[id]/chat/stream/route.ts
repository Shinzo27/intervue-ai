import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin SSE proxy for the interviewer's streaming turn.
 *
 * The upstream response body is piped straight through, so `start` → `delta`
 * frames reach the browser as they are produced (the portal renders the reply
 * progressively; today the agent emits one delta per turn, and token-level
 * streaming from the provider flows through this same contract unchanged).
 */
const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:3100";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;

  try {
    const upstream = await fetch(`${AI_SERVICE}/interviews/${id}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await req.text(),
      cache: "no-store",
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message:
            error instanceof Error
              ? `interviewer unavailable: ${error.message}`
              : "interviewer unavailable",
        },
      },
      { status: 502 },
    );
  }
}
