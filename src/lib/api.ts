import { NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth';
import { VaultError } from '@/lib/vault';

export function apiErrorResponse(error: unknown, fallback: string): NextResponse {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;
  if (error instanceof VaultError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
    return NextResponse.json({ error: 'Vault item not found.', code: 'NOT_FOUND' }, { status: 404 });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 6 * 1024 * 1024) throw new VaultError('Request body is too large.', 'BODY_TOO_LARGE', 413);
  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new VaultError('Expected a JSON object.', 'INVALID_BODY');
  }
  return body as Record<string, unknown>;
}

export function requiredString(body: Record<string, unknown>, key: string): string {
  if (typeof body[key] !== 'string' || !body[key]) {
    throw new VaultError(`Missing ${key}.`, 'INVALID_BODY');
  }
  return body[key] as string;
}

export function stringValue(body: Record<string, unknown>, key: string): string {
  if (typeof body[key] !== 'string') {
    throw new VaultError(`Invalid ${key}.`, 'INVALID_BODY');
  }
  return body[key] as string;
}
