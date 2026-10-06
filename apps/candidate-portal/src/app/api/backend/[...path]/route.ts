import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin proxy to the Intervue backend.
 *
 * The candidate portal is a public, account-less app: routing its calls
 * through this handler keeps the browser same-origin (no CORS surface) and
 * keeps backend URLs out of the client bundle. Candidate endpoints are
 * token-scoped, so no cookies or credentials are forwarded.
 */
const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3000/api";

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await ctx.params;
  const url = `${BACKEND}/${path.join("/")}${req.nextUrl.search}`;

  const init: RequestInit = { method: req.method, cache: "no-store" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
    init.headers = { "Content-Type": "application/json" };
  }

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? `backend unreachable: ${error.message}`
            : "backend unreachable",
      },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
