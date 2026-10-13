import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/models/User';
import { hashSecret, verifySecret } from '@/lib/auth/crypto';
import { audit, getAuth, jsonError, PIN_PATTERN, rateLimit, str, serverError } from '@/lib/auth';

// Signed-in staff change their own PIN; the current PIN is always required
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth.user) return jsonError('Sign in required', 401);
    if (!rateLimit(`change-pin:${auth.user.id}`, 5)) return jsonError('Too many attempts. Please wait a few minutes.', 429);

    const body = await req.json();
    const currentPin = str(body.currentPin, 6);
    const newPin = str(body.newPin, 6);
    if (!PIN_PATTERN.test(newPin)) return jsonError('New PIN must be 4–6 digits', 400);

    const user = await UserModel.findById(auth.user.id).select('+pinHash');
    if (!user || !(await verifySecret(currentPin, user.pinHash))) return jsonError('Current PIN is incorrect', 401);

    user.pinHash = await hashSecret(newPin);
    await user.save();
    await audit(auth, 'auth.pin_changed', auth.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
