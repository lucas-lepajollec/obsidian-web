import { NextRequest, NextResponse } from 'next/server';
import { readVaultFile, writeVaultFile, renameVaultItem, deleteVaultItem, createVaultFolder } from '@/lib/vault';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  const content = readVaultFile(filePath);

  if (content === null) {
    return NextResponse.json({ error: "File not found or access denied" }, { status: 404 });
  }

  return NextResponse.json({ content });
}

export async function POST(request: NextRequest) {
  // Check password if env set
  const editPassword = process.env.PERLITE_EDIT_PASSWORD;
  
  try {
    const body = await request.json();
    const { path, content, password } = body;

    if (!path || content === undefined) {
      return NextResponse.json({ error: "Missing path or content" }, { status: 400 });
    }

    if (editPassword && password !== editPassword) {
      return NextResponse.json({ error: "Unauthorized: Invalid password" }, { status: 401 });
    }

    const success = writeVaultFile(path, content);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const editPassword = process.env.PERLITE_EDIT_PASSWORD;
  
  try {
    const body = await request.json();
    const { action, path, newPath, password } = body;

    if (editPassword && password !== editPassword) {
      return NextResponse.json({ error: "Unauthorized: Invalid password" }, { status: 401 });
    }

    if (action === 'rename' && path && newPath) {
      const success = renameVaultItem(path, newPath);
      return success ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Failed to rename" }, { status: 500 });
    } 
    
    if (action === 'mkdir' && path) {
      const success = createVaultFolder(path);
      return success ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const editPassword = process.env.PERLITE_EDIT_PASSWORD;
  
  try {
    const body = await request.json();
    const { path, password } = body;

    if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

    if (editPassword && password !== editPassword) {
      return NextResponse.json({ error: "Unauthorized: Invalid password" }, { status: 401 });
    }

    const success = deleteVaultItem(path);
    return success ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

