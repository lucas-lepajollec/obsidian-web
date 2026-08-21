import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api';
import { readVaultAsset } from '@/lib/vault';

export async function GET(request: NextRequest) {
  try {
    requireSession(request, 'read');
    const assetPath = request.nextUrl.searchParams.get('path');
    if (!assetPath) return Response.json({ error: 'Missing path.' }, { status: 400 });
    const asset = await readVaultAsset(assetPath);
    return new Response(new Blob([new Uint8Array(asset.data)]), {
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(asset.data.byteLength),
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to read this attachment.');
  }
}
