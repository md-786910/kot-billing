import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { UserModel, UserRole, USER_ROLES } from '@/models/User';
import { hashSecret } from '@/lib/auth/crypto';
import { audit, isLocked, jsonError, PIN_PATTERN, requireAuth, revokeUserSessions, str, serverError } from '@/lib/auth';

const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'staff.manage');
  if (!guard.ok) return guard.response;
  try {
    const users = await UserModel.find({}).select('+passwordHash').sort({ isActive: -1, name: 1 }).lean();
    return NextResponse.json({
      success: true,
      data: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        role: u.role,
        phone: u.phone ?? '',
        username: u.username ?? '',
        hasPassword: !!u.passwordHash,
        isActive: u.isActive,
        isLocked: isLocked(u),
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, 'staff.manage');
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const name = str(body.name, 60);
    const role = str(body.role, 20) as UserRole;
    const pin = str(body.pin, 6);
    const username = str(body.username, 40).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!name) return jsonError('Enter a name', 400);
    if (!USER_ROLES.includes(role)) return jsonError('Choose a role', 400);
    if (!PIN_PATTERN.test(pin)) return jsonError('PIN must be 4–6 digits', 400);
    if (username && !USERNAME_PATTERN.test(username)) return jsonError('Username: 3+ letters, numbers, . _ -', 400);
    if (username && password.length < 8) return jsonError('Password must be at least 8 characters', 400);
    if (username && (await UserModel.exists({ username }))) return jsonError('Username is already taken', 409);

    const user = await UserModel.create({
      name,
      role,
      phone: str(body.phone, 20),
      pinHash: await hashSecret(pin),
      ...(username ? { username, passwordHash: await hashSecret(password) } : {}),
    });
    await audit(guard.auth, 'staff.created', String(user._id), { name, role });
    return NextResponse.json({ success: true, data: { id: String(user._id) } });
  } catch (error) {
    return serverError(error);
  }
}

// Update details, reset PIN/password, unlock, activate/deactivate
export async function PATCH(req: NextRequest) {
  const guard = await requireAuth(req, 'staff.manage');
  if (!guard.ok) return guard.response;
  const { auth } = guard;
  try {
    const body = await req.json();
    const id = str(body.id, 40);
    if (!mongoose.isValidObjectId(id)) return jsonError('Staff member not found', 404);
    const user = await UserModel.findById(id).select('+passwordHash');
    if (!user) return jsonError('Staff member not found', 404);

    const changes: string[] = [];
    let signOut = false;

    if (body.name !== undefined) {
      const name = str(body.name, 60);
      if (!name) return jsonError('Enter a name', 400);
      user.name = name;
      changes.push('name');
    }
    if (body.phone !== undefined) {
      user.phone = str(body.phone, 20);
      changes.push('phone');
    }
    if (body.role !== undefined) {
      const role = str(body.role, 20) as UserRole;
      if (!USER_ROLES.includes(role)) return jsonError('Choose a role', 400);
      if (user.role === 'ADMIN' && role !== 'ADMIN' && (await isLastAdmin(id))) {
        return jsonError('Keep at least one active admin', 400);
      }
      if (role !== user.role) signOut = true;
      user.role = role;
      changes.push('role');
    }
    if (body.isActive !== undefined) {
      const isActive = body.isActive === true;
      if (!isActive && id === auth.user?.id) return jsonError('You cannot deactivate yourself', 400);
      if (!isActive && user.role === 'ADMIN' && (await isLastAdmin(id))) return jsonError('Keep at least one active admin', 400);
      if (!isActive) signOut = true;
      user.isActive = isActive;
      changes.push(isActive ? 'activated' : 'deactivated');
    }
    if (body.pin !== undefined) {
      const pin = str(body.pin, 6);
      if (!PIN_PATTERN.test(pin)) return jsonError('PIN must be 4–6 digits', 400);
      user.pinHash = await hashSecret(pin);
      user.failedAttempts = 0;
      user.lockedUntil = null;
      changes.push('pin_reset');
    }
    if (body.username !== undefined) {
      const username = str(body.username, 40).toLowerCase();
      if (!username) {
        if (user.role === 'ADMIN' && (await isLastAdmin(id))) return jsonError('Keep at least one admin with a password', 400);
        user.set('username', undefined);
        user.set('passwordHash', undefined);
        signOut = true;
        changes.push('password_removed');
      } else {
        if (!USERNAME_PATTERN.test(username)) return jsonError('Username: 3+ letters, numbers, . _ -', 400);
        if (await UserModel.exists({ username, _id: { $ne: id } })) return jsonError('Username is already taken', 409);
        user.username = username;
        changes.push('username');
      }
    }
    if (body.password !== undefined && user.username) {
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length < 8) return jsonError('Password must be at least 8 characters', 400);
      user.passwordHash = await hashSecret(password);
      user.failedAttempts = 0;
      user.lockedUntil = null;
      signOut = true;
      changes.push('password_reset');
    }
    if (user.username && !user.passwordHash) return jsonError('Set a password for this username', 400);
    if (body.unlock === true) {
      user.failedAttempts = 0;
      user.lockedUntil = null;
      changes.push('unlocked');
    }

    await user.save();
    if (signOut) await revokeUserSessions(id);
    await audit(auth, 'staff.updated', id, { name: user.name, changes });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}

// Another active admin who can sign in with a password must remain, or first-run setup would reopen
async function isLastAdmin(id: string) {
  const others = await UserModel.countDocuments({
    role: 'ADMIN', isActive: true, passwordHash: { $exists: true }, _id: { $ne: id },
  });
  return others === 0;
}
