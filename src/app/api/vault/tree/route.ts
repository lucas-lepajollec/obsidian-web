import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api';
import { buildVaultTree } from '@/lib/vault';

export async function GET(request: NextRequest) {
  try {
    requireSession(request, 'read');
    return NextResponse.json({ tree: await buildVaultTree() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to read the vault.');
  }
}
