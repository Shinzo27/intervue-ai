/** Backend API base (Better Auth is mounted under /api/auth). */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Fetch JSON from the backend with the session cookie attached.
 * All recruiter routes are organization-scoped server-side; the dashboard
 * never sends an organization id it could tamper with.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status);
  }

  const body = (await res.json()) as { data?: T } & T;
  // The backend wraps successes as { success, data }.
  return (body as { data?: T }).data ?? (body as T);
}
