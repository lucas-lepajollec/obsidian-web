import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api';
import { searchVault } from '@/lib/vault';

export async function GET(request: NextRequest) {
  try {
    requireSession(request, 'read');
    const query = request.nextUrl.searchParams.get('q') ?? '';
    return NextResponse.json({ results: await searchVault(query) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to search the vault.');
  }
}
