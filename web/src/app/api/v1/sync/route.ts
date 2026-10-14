import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, serverError } from '@/lib/auth';
import { syncVersion } from '@/lib/realtime';

/** Tiny poll for screens: reload data only when this version changes */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json({ success: true, data: { version: await syncVersion() } });
  } catch (error) {
    return serverError(error);
  }
}
