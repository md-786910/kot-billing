import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { UserModel } from '@/models/User';
import { verifySecret } from '@/lib/auth/crypto';
import {
  audit, clearFailedAttempts, createSession, getAuth, isLocked, jsonError, LOCKED_MESSAGE, PIN_PATTERN,
  rateLimit, recordFailedAttempt, respondWithSession, str, serverError,
} from '@/lib/auth';

// Staff PIN sign-in. Only allowed on a paired terminal or phone; the session is bound to that device.
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth.device || auth.device.type === 'DISPLAY') {
      return jsonError('This device is not paired for staff sign-in', 401);
    }
    if (!(await rateLimit(`pin:${auth.device.id}`, 15))) return jsonError('Too many attempts. Please wait a few minutes.', 429);

    const body = await req.json();
    const userId = str(body.userId, 40);
    const pin = str(body.pin, 6);
    if (!mongoose.isValidObjectId(userId) || !PIN_PATTERN.test(pin)) return jsonError('Select your name and enter your PIN', 400);

    const user = await UserModel.findOne({ _id: userId, isActive: true }).select('+pinHash');
    if (!user || !user.pinHash) return jsonError('Incorrect PIN', 401);
    if (isLocked(user)) return jsonError(LOCKED_MESSAGE, 423);

    if (!(await verifySecret(pin, user.pinHash))) {
      await recordFailedAttempt(String(user._id), user.failedAttempts);
      await audit(auth, 'auth.pin_failed', String(user._id));
      return jsonError('Incorrect PIN', 401);
    }

    await clearFailedAttempts(String(user._id));
    const data = { id: String(user._id), name: user.name, role: user.role };
    const session = await createSession(data.id, 'PIN', auth.device.id);
    await audit({ ...auth, user: data, actorName: data.name }, 'auth.pin_login', data.id);
    return respondWithSession(req, { user: data }, session);
  } catch (error) {
    return serverError(error);
  }
}
