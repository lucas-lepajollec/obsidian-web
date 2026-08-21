import { NextResponse } from 'next/server';
import { getAuthConfig } from '@/lib/config';
import { getVaultRoot } from '@/lib/vault';
import { promises as fs } from 'node:fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    getAuthConfig();
    await fs.access(getVaultRoot());
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'degraded' }, { status: 503 });
  }
}
