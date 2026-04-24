import { NextRequest, NextResponse } from 'next/server';
import { searchVault } from '@/lib/vault';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ results: [] });

  const results = searchVault(q);
  return NextResponse.json({ results });
}
