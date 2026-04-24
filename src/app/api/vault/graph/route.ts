import { NextResponse } from 'next/server';
import { buildGraphData } from '@/lib/vault';

export async function GET() {
  try {
    const data = buildGraphData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ nodes: [], edges: [] });
  }
}
