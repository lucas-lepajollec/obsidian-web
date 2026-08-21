import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { ConfigurationError, getAuthConfig } from '@/lib/config';

const COOKIE_NAME = 'shardnote_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

interface LoginBucket {
  attempts: number;
  resetAt: number;
}

const loginBuckets = new Map<string, LoginBucket>();

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = createHash('sha256').update(left).digest();
  const rightBuffer = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function requestIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'local';
}

export function assertSameOrigin(request: NextRequest): void {
  const marker = request.headers.get('x-shardnote-request');
  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host');
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(':', '');
  const expectedOrigin = host ? `${protocol}://${host}` : request.nextUrl.origin;
  const fetchSite = request.headers.get('sec-fetch-site');

  if (marker !== '1' || !origin || origin !== expectedOrigin) {
    throw new AuthError('Cross-origin request rejected.', 403);
  }
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new AuthError('Cross-site request rejected.', 403);
  }
}

export class AuthError extends Error {
  constructor(message: string, public readonly status = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

export function isLoginRateLimited(request: NextRequest): boolean {
  const key = requestIp(request);
  const now = Date.now();
  const bucket = loginBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    loginBuckets.set(key, { attempts: 0, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  return bucket.attempts >= LOGIN_MAX_ATTEMPTS;
}

export function recordLoginFailure(request: NextRequest): void {
  const key = requestIp(request);
  const now = Date.now();
  const bucket = loginBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    loginBuckets.set(key, { attempts: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  bucket.attempts += 1;
}

export function clearLoginFailures(request: NextRequest): void {
  loginBuckets.delete(requestIp(request));
}

export function verifyPassword(candidate: string): boolean {
  const { password, authDisabled } = getAuthConfig();
  return authDisabled || safeEqual(candidate, password);
}

export function createSessionToken(): string {
  const { sessionSecret, authDisabled } = getAuthConfig();
  if (authDisabled) return 'development';

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${expiresAt}.${randomBytes(16).toString('base64url')}`;
  return `${encode(payload)}.${sign(payload, sessionSecret)}`;
}

export function hasValidSession(request: NextRequest): boolean {
  const config = getAuthConfig();
  if (config.authDisabled) return true;

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return false;

  try {
    const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const [expires] = payload.split('.');
    if (!expires || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
    return safeEqual(signature, sign(payload, config.sessionSecret));
  } catch {
    return false;
  }
}

export function requireSession(request: NextRequest, mode: 'read' | 'write'): void {
  const config = getAuthConfig();
  if (config.authDisabled) return;
  if (mode === 'read' && config.publicRead) return;
  if (!hasValidSession(request)) throw new AuthError('Authentication required.');
}

export function setSessionCookie(response: NextResponse, token: string): void {
  const { secureCookies } = getAuthConfig();
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookies,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    priority: 'high',
  });
}

export function clearSessionCookie(response: NextResponse): void {
  const { secureCookies } = getAuthConfig();
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookies,
    path: '/',
    maxAge: 0,
  });
}

export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ConfigurationError) {
    return NextResponse.json({ error: error.message, configured: false }, { status: 503 });
  }
  return null;
}
