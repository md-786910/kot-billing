import { NextRequest, NextResponse } from 'next/server';
import { SessionModel } from '@/models/Session';
import { audit, clearSessionCookie, getAuth, jsonError } from '@/lib/auth';

// Ends the staff session; the device stays paired
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (auth.sessionId) {
      await SessionModel.updateOne({ _id: auth.sessionId }, { revokedAt: new Date() });
      await audit(auth, 'auth.logout', auth.user?.id);
    }
    const res = NextResponse.json({ success: true });
    clearSessionCookie(res);
    return res;
  } catch (error: any) {
    return jsonError(error.message, 500);
  }
}
