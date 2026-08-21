import { NextRequest, NextResponse } from 'next/server';
import {
  assertSameOrigin,
  authErrorResponse,
  clearLoginFailures,
  clearSessionCookie,
  createSessionToken,
  hasValidSession,
  isLoginRateLimited,
  recordLoginFailure,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { getAuthConfig } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const config = getAuthConfig();
    return NextResponse.json({
      authenticated: hasValidSession(request),
      configured: true,
      publicRead: config.publicRead,
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Unable to inspect session.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (isLoginRateLimited(request)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const body: unknown = await request.json();
    const password = typeof body === 'object' && body !== null && 'password' in body
      ? String(body.password)
      : '';

    if (!verifyPassword(password)) {
      recordLoginFailure(request);
      return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
    }

    clearLoginFailures(request);
    const response = NextResponse.json({ authenticated: true });
    setSessionCookie(response, createSessionToken());
    return response;
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Unable to sign in.' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ authenticated: false });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Unable to sign out.' }, { status: 400 });
  }
}
