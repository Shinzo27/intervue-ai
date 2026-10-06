import { NextRequest, NextResponse } from "next/server";

/** Same-origin proxy to the interviewer's opening turn. */
const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:3100";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;

  try {
    const res = await fetch(`${AI_SERVICE}/interviews/${id}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
