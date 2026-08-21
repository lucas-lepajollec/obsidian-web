export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-shardnote-request', '1');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {
    // Keep a useful generic error when a proxy returns a non-JSON page.
  }

  if (!response.ok) {
    throw new ApiError(
      typeof payload.error === 'string' ? payload.error : `Request failed (${response.status}).`,
      response.status,
      typeof payload.code === 'string' ? payload.code : undefined,
    );
  }
  return payload as T;
}
