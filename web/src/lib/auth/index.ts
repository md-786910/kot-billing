import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel, UserRole } from '@/models/User';
import { DeviceModel, DeviceStation, DeviceType } from '@/models/Device';
import { SessionModel } from '@/models/Session';
import { AuditLogModel } from '@/models/AuditLog';
import { generateToken, hashSecret, sha256, verifySecret } from './crypto';
import { displayPermissions, OVERRIDABLE, Permission, ROLE_PERMISSIONS } from './permissions';

export const SESSION_COOKIE = 'ly_session';
export const DEVICE_COOKIE = 'ly_device';

export const PIN_SESSION_HOURS = 12;
// Shared-device PIN sessions also end server-side after this long without any API call
const PIN_SESSION_IDLE_MS = 15 * 60_000;
export const PASSWORD_SESSION_HOURS = 8;
const DEVICE_COOKIE_DAYS = 365;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuthDevice {
  id: string;
  name: string;
  type: DeviceType;
  station: DeviceStation | null;
  printStation: boolean;
}

export interface AuthContext {
  user: AuthUser | null;
  device: AuthDevice | null;
  sessionId: string | null;
  permissions: Permission[];
  /** Name recorded on orders, KOTs and audit entries */
  actorName: string;
}

// ---------- Request helpers ----------

/** Mobile clients send tokens as headers and receive them in JSON; browsers use httpOnly cookies. */
export function isMobileClient(req: NextRequest): boolean {
  return req.headers.get('x-client') === 'mobile';
}

function readSessionToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  return req.cookies.get(SESSION_COOKIE)?.value || null;
}

function readDeviceToken(req: NextRequest): string | null {
  return req.headers.get('x-device-token') || req.cookies.get(DEVICE_COOKIE)?.value || null;
}

/** Client address for rate limiting. Forwarded headers are only trusted behind a proxy (TRUST_PROXY=true). */
export function clientIp(req: NextRequest): string {
  if (process.env.TRUST_PROXY !== 'true' && process.env.VERCEL !== '1') return 'direct';
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'direct';
}

/** Trimmed string input, or '' when missing, not a string, or longer than `max` (never silently truncated). */
export function str(value: unknown, max = 200): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > max ? '' : trimmed;
}

export const PIN_PATTERN = /^\d{4,6}$/;

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === 'true';
  return process.env.NODE_ENV === 'production';
}

export function setSessionCookie(res: NextResponse, token: string, hours: number) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: cookieSecure(), path: '/', maxAge: hours * 3600,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: cookieSecure(), path: '/', maxAge: 0 });
}

export function setDeviceCookie(res: NextResponse, token: string) {
  res.cookies.set(DEVICE_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: cookieSecure(), path: '/', maxAge: DEVICE_COOKIE_DAYS * 86400,
  });
}

export function clearDeviceCookie(res: NextResponse) {
  res.cookies.set(DEVICE_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: cookieSecure(), path: '/', maxAge: 0 });
}

export function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

/** Log the real error server-side; never leak internals to the client. */
export function serverError(error: unknown) {
  if (error instanceof SyntaxError) return jsonError('Invalid request body', 400);
  console.error(error);
  return jsonError('Something went wrong. Please try again.', 500);
}

/** Success response carrying a new session: a cookie for browsers, `sessionToken` in the body for mobile. */
export function respondWithSession(req: NextRequest, data: unknown, session: { token: string; hours: number }) {
  const mobile = isMobileClient(req);
  const res = NextResponse.json({ success: true, data, ...(mobile ? { sessionToken: session.token } : {}) });
  if (!mobile) setSessionCookie(res, session.token, session.hours);
  return res;
}

/** Success response carrying a new device token: a cookie for browsers, `deviceToken` in the body for mobile. */
export function respondWithDevice(req: NextRequest, data: unknown, deviceToken: string) {
  const mobile = isMobileClient(req);
  const res = NextResponse.json({ success: true, data, ...(mobile ? { deviceToken } : {}) });
  if (!mobile) setDeviceCookie(res, deviceToken);
  return res;
}

// ---------- Resolving who is calling ----------

const TOUCH_INTERVAL_MS = 60_000;

export async function getAuth(req: NextRequest): Promise<AuthContext> {
  await connectToDatabase();
  const now = new Date();

  let device: AuthDevice | null = null;
  const deviceToken = readDeviceToken(req);
  if (deviceToken) {
    const doc = await DeviceModel.findOne({ tokenHash: sha256(deviceToken), revokedAt: null }).lean();
    if (doc) {
      device = { id: String(doc._id), name: doc.name, type: doc.type, station: doc.station ?? null, printStation: !!doc.printStation };
      if (!doc.lastSeenAt || now.getTime() - new Date(doc.lastSeenAt).getTime() > TOUCH_INTERVAL_MS) {
        await DeviceModel.updateOne({ _id: doc._id }, { lastSeenAt: now });
      }
    }
  }

  let user: AuthUser | null = null;
  let sessionId: string | null = null;
  const sessionToken = readSessionToken(req);
  if (sessionToken) {
    const found = await SessionModel.findOne({
      tokenHash: sha256(sessionToken),
      revokedAt: null,
      expiresAt: { $gt: now },
    }).lean();
    const idle = found?.method === 'PIN' && now.getTime() - new Date(found.lastUsedAt).getTime() > PIN_SESSION_IDLE_MS;
    const session = idle ? null : found;
    // A PIN session only works from the device it was opened on
    const deviceMatches = !session?.deviceId || session.deviceId === device?.id;
    if (session && deviceMatches) {
      const doc = await UserModel.findOne({ _id: session.userId, isActive: true }).lean();
      if (doc) {
        user = { id: String(doc._id), name: doc.name, role: doc.role };
        sessionId = String(session._id);
        if (now.getTime() - new Date(session.lastUsedAt).getTime() > TOUCH_INTERVAL_MS) {
          await SessionModel.updateOne({ _id: session._id }, { lastUsedAt: now });
        }
      }
    }
  }

  let permissions: Permission[] = [];
  if (user) permissions = ROLE_PERMISSIONS[user.role] ?? [];
  else if (device?.type === 'DISPLAY') permissions = displayPermissions(device.station);

  return { user, device, sessionId, permissions, actorName: user?.name ?? device?.name ?? 'Unknown' };
}

export type Guard = { ok: true; auth: AuthContext } | { ok: false; response: NextResponse };

/** Resolve the caller and check a permission. Usage: `const g = await requireAuth(req, 'x'); if (!g.ok) return g.response;` */
export async function requireAuth(req: NextRequest, permission: Permission = 'data.read'): Promise<Guard> {
  const auth = await getAuth(req);
  if (!auth.user && !auth.device) return { ok: false, response: jsonError('Sign in required', 401) };
  if (!auth.user && auth.device?.type !== 'DISPLAY') {
    return { ok: false, response: jsonError('Staff sign in required', 401) };
  }
  if (!auth.permissions.includes(permission)) {
    return { ok: false, response: jsonError('You do not have permission for this action', 403) };
  }
  return { ok: true, auth };
}

// ---------- Sessions ----------

export async function createSession(userId: string, method: 'PASSWORD' | 'PIN', deviceId: string | null) {
  const token = generateToken();
  const hours = method === 'PIN' ? PIN_SESSION_HOURS : PASSWORD_SESSION_HOURS;
  await SessionModel.create({
    tokenHash: sha256(token),
    userId,
    deviceId,
    method,
    expiresAt: new Date(Date.now() + hours * 3600_000),
    lastUsedAt: new Date(),
  });
  return { token, hours };
}

export async function revokeUserSessions(userId: string) {
  await SessionModel.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

export async function revokeDeviceSessions(deviceId: string) {
  await SessionModel.updateMany({ deviceId, revokedAt: null }, { revokedAt: new Date() });
}

// ---------- Brute-force protection ----------

declare global {
  var rateLimitIndexReady: Promise<string> | undefined;
}

/**
 * Fixed-window limiter stored in MongoDB, so every server instance (e.g. Vercel functions) shares the count.
 * Returns false when the key is over its limit for the current window.
 */
export async function rateLimit(key: string, limit = 10, windowMs = 5 * 60_000): Promise<boolean> {
  await connectToDatabase();
  const col = mongoose.connection.collection<{ _id: string; count: number; expiresAt: Date }>('ratelimits');
  // Old windows delete themselves
  global.rateLimitIndexReady ??= col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await global.rateLimitIndexReady;
  const window = Math.floor(Date.now() / windowMs);
  const res = await col
    .findOneAndUpdate(
      { _id: `${key}:${window}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 1) * windowMs + 60_000) } },
      { upsert: true, returnDocument: 'after' }
    );
  return (res?.count ?? 1) <= limit;
}

export function isLocked(user: { lockedUntil?: Date | null }): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now();
}

export async function recordFailedAttempt(userId: string, failedAttempts: number) {
  const next = failedAttempts + 1;
  if (next >= MAX_FAILED_ATTEMPTS) {
    await UserModel.updateOne(
      { _id: userId },
      { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) }
    );
    return;
  }
  await UserModel.updateOne({ _id: userId }, { failedAttempts: next });
}

export async function clearFailedAttempts(userId: string) {
  await UserModel.updateOne({ _id: userId }, { failedAttempts: 0, lockedUntil: null });
}

export const LOCKED_MESSAGE = `Too many wrong attempts. Try again in ${LOCKOUT_MINUTES} minutes.`;

// ---------- Manager approval ----------

/**
 * Checks the caller can perform `permission`, or that `approvalPin` belongs to an active staff
 * member who can. Returns the approver's name ('' when no approval was needed) or an error response.
 */
export async function authorizeOrApprove(
  req: NextRequest,
  auth: AuthContext,
  permission: Permission,
  approvalPin: unknown
): Promise<{ ok: true; approvedBy: string } | { ok: false; response: NextResponse }> {
  if (auth.permissions.includes(permission)) return { ok: true, approvedBy: '' };
  if (!OVERRIDABLE.includes(permission)) {
    return { ok: false, response: jsonError('You do not have permission for this action', 403) };
  }

  const pin = str(approvalPin, 6);
  if (!PIN_PATTERN.test(pin)) {
    return { ok: false, response: jsonError('Manager PIN required', 403) };
  }
  if (!(await rateLimit(`approve:${auth.device?.id ?? clientIp(req)}`, 5))) {
    return { ok: false, response: jsonError('Too many attempts. Please wait a few minutes.', 429) };
  }

  const roles = (Object.keys(ROLE_PERMISSIONS) as UserRole[]).filter((r) => ROLE_PERMISSIONS[r].includes(permission));
  const approvers = await UserModel.find({ role: { $in: roles }, isActive: true, pinHash: { $exists: true } })
    .select('+pinHash name lockedUntil')
    .lean();

  for (const approver of approvers) {
    if (!isLocked(approver) && (await verifySecret(pin, approver.pinHash))) {
      return { ok: true, approvedBy: approver.name };
    }
  }
  return { ok: false, response: jsonError('Invalid manager PIN', 403) };
}

// ---------- Audit ----------

export async function audit(
  auth: AuthContext | null,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown>,
  approvedBy?: string
) {
  try {
    await AuditLogModel.create({
      action,
      actorId: auth?.user?.id ?? null,
      actorName: auth?.actorName ?? null,
      deviceId: auth?.device?.id ?? null,
      deviceName: auth?.device?.name ?? null,
      approvedBy: approvedBy || null,
      target: target ?? null,
      meta,
    });
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

// ---------- Setup & migration ----------

export async function isSetupRequired(): Promise<boolean> {
  await connectToDatabase();
  const owner = await UserModel.exists({ role: 'ADMIN', isActive: true, passwordHash: { $exists: true } });
  return !owner;
}

/** Hash any plaintext PINs left over from before authentication was added. */
export async function migrateLegacyPins() {
  const legacy = await UserModel.find({ pin: { $exists: true, $ne: null } }).select('+pin +pinHash');
  for (const user of legacy) {
    if (!user.pinHash && user.pin) user.pinHash = await hashSecret(user.pin);
    user.set('pin', undefined);
    await user.save();
  }
}
