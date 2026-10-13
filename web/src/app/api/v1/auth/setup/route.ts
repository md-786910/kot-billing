import { NextRequest } from 'next/server';
import { UserModel } from '@/models/User';
import { hashSecret } from '@/lib/auth/crypto';
import { audit, createSession, isSetupRequired, jsonError, PIN_PATTERN, respondWithSession, str, serverError } from '@/lib/auth';

// First run only: create the owner account
export async function POST(req: NextRequest) {
  try {
    if (!(await isSetupRequired())) return jsonError('Setup is already complete', 409);

    const body = await req.json();
    const name = str(body.name, 60);
    const username = str(body.username, 40).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const pin = str(body.pin, 6);

    if (!name || !/^[a-z0-9._-]{3,40}$/.test(username)) {
      return jsonError('Enter a name and a username (3+ letters, numbers, . _ -)', 400);
    }
    if (password.length < 8) return jsonError('Password must be at least 8 characters', 400);
    if (!PIN_PATTERN.test(pin)) return jsonError('PIN must be 4–6 digits', 400);

    // Retire demo staff from earlier builds (their PINs were public); the owner adds real staff next
    await UserModel.updateMany({}, { isActive: false });

    const owner = await UserModel.create({
      name,
      username,
      role: 'ADMIN',
      passwordHash: await hashSecret(password),
      pinHash: await hashSecret(pin),
    });

    const user = { id: String(owner._id), name: owner.name, role: owner.role };
    await audit({ user, device: null, sessionId: null, permissions: [], actorName: user.name }, 'auth.setup', user.id);

    const session = await createSession(user.id, 'PASSWORD', null);
    return respondWithSession(req, { user }, session);
  } catch (error) {
    return serverError(error);
  }
}
