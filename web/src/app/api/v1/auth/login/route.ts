import { NextRequest } from 'next/server';
import { UserModel } from '@/models/User';
import { verifySecret } from '@/lib/auth/crypto';
import {
  audit, clearFailedAttempts, clientIp, createSession, getAuth, isLocked, jsonError, LOCKED_MESSAGE,
  rateLimit, recordFailedAttempt, respondWithSession, str, serverError,
} from '@/lib/auth';

// Username + password sign-in (owner / managers). Works from any browser, paired or not.
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`login:${clientIp(req)}`)) return jsonError('Too many attempts. Please wait a few minutes.', 429);

    const body = await req.json();
    const username = str(body.username, 40).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) return jsonError('Enter your username and password', 400);

    const auth = await getAuth(req);
    const user = await UserModel.findOne({ username, isActive: true }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      await audit(auth, 'auth.login_failed', username);
      return jsonError('Incorrect username or password', 401);
    }
    if (isLocked(user)) return jsonError(LOCKED_MESSAGE, 423);

    if (!(await verifySecret(password, user.passwordHash))) {
      await recordFailedAttempt(String(user._id), user.failedAttempts);
      await audit(auth, 'auth.login_failed', username);
      return jsonError('Incorrect username or password', 401);
    }

    await clearFailedAttempts(String(user._id));
    const data = { id: String(user._id), name: user.name, role: user.role };
    // Bind to this device when signing in on a paired terminal, so the session can't leave it
    const session = await createSession(data.id, 'PASSWORD', auth.device?.id ?? null);
    await audit({ ...auth, user: data, actorName: data.name }, 'auth.login', data.id);
    return respondWithSession(req, { user: data }, session);
  } catch (error) {
    return serverError(error);
  }
}
