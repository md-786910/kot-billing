import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isSetupRequired } from '@/lib/auth';

// Public: tells a client which screen to show (setup, sign in / pair, PIN lock, or the app)
export async function GET(req: NextRequest) {
  try {
    const setupRequired = await isSetupRequired();
    const auth = await getAuth(req);
    return NextResponse.json({
      success: true,
      data: {
        setupRequired,
        user: auth.user,
        device: auth.device,
        permissions: auth.permissions,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
