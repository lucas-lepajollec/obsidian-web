import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api';
import { buildGraphData } from '@/lib/vault';

export async function GET(request: NextRequest) {
  try {
    requireSession(request, 'read');
    return NextResponse.json(await buildGraphData(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to build the graph.');
  }
}
