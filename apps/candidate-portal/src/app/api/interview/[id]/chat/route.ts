import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin proxy to the ai-service conversational interviewer
 * (`POST /interviews/:id/chat`). The ai-service has no CORS configuration —
 * it is an internal service — so the portal never calls it directly.
 */
const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:3100";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;

  try {
    const res = await fetch(`${AI_SERVICE}/interviews/${id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await req.text(),
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
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
