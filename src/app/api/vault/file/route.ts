import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, requireSession } from '@/lib/auth';
import { apiErrorResponse, readJsonObject, requiredString, stringValue } from '@/lib/api';
import { createVaultFolder, deleteVaultItem, readVaultFile, renameVaultItem, writeVaultFile } from '@/lib/vault';

export async function GET(request: NextRequest) {
  try {
    requireSession(request, 'read');
    const filePath = request.nextUrl.searchParams.get('path');
    if (!filePath) return NextResponse.json({ error: 'Missing path.' }, { status: 400 });
    return NextResponse.json(await readVaultFile(filePath), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to read this note.');
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireSession(request, 'write');
    const body = await readJsonObject(request);
    const path = requiredString(body, 'path');
    const content = stringValue(body, 'content');
    const expectedMtimeMs = typeof body.expectedMtimeMs === 'number' ? body.expectedMtimeMs : undefined;
    return NextResponse.json(await writeVaultFile(path, content, expectedMtimeMs));
  } catch (error) {
    return apiErrorResponse(error, 'Unable to save this note.');
  }
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireSession(request, 'write');
    const body = await readJsonObject(request);
    const action = requiredString(body, 'action');
    const path = requiredString(body, 'path');
    if (action === 'rename') {
      return NextResponse.json(await renameVaultItem(path, requiredString(body, 'newPath')));
    }
    if (action === 'mkdir') {
      return NextResponse.json(await createVaultFolder(path));
    }
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update this vault item.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireSession(request, 'write');
    const body = await readJsonObject(request);
    return NextResponse.json(await deleteVaultItem(requiredString(body, 'path')));
  } catch (error) {
    return apiErrorResponse(error, 'Unable to move this item to the trash.');
  }
}
