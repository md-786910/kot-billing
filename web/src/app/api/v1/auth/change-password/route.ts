import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/models/User';
import { SessionModel } from '@/models/Session';
import { hashSecret, verifySecret } from '@/lib/auth/crypto';
import { audit, getAuth, jsonError, rateLimit, serverError } from '@/lib/auth';

// Signed-in users with a password change it; other sessions of the same user are signed out
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth.user) return jsonError('Sign in required', 401);
    if (!rateLimit(`change-password:${auth.user.id}`, 5)) return jsonError('Too many attempts. Please wait a few minutes.', 429);

    const body = await req.json();
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (newPassword.length < 8) return jsonError('New password must be at least 8 characters', 400);

    const user = await UserModel.findById(auth.user.id).select('+passwordHash');
    if (!user?.passwordHash || !(await verifySecret(currentPassword, user.passwordHash))) {
      return jsonError('Current password is incorrect', 401);
    }

    user.passwordHash = await hashSecret(newPassword);
    await user.save();
    await SessionModel.updateMany(
      { userId: auth.user.id, revokedAt: null, _id: { $ne: auth.sessionId } },
      { revokedAt: new Date() }
    );
    await audit(auth, 'auth.password_changed', auth.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
