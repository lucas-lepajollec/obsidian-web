import { NextResponse } from 'next/server';
import { buildVaultTree } from '@/lib/vault';

export async function GET() {
  try {
    const tree = buildVaultTree();
    return NextResponse.json({ tree });
  } catch (error) {
    console.error("Error building vault tree:", error);
    return NextResponse.json({ error: "Failed to read vault" }, { status: 500 });
  }
}
