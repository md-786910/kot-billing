import { NextRequest, NextResponse } from 'next/server';
import { DeviceModel } from '@/models/Device';
import { PairingCodeModel } from '@/models/PairingCode';
import { generateToken, sha256 } from '@/lib/auth/crypto';
import {
  audit, clearDeviceCookie, clearSessionCookie, clientIp, getAuth, jsonError, rateLimit,
  respondWithDevice, revokeDeviceSessions, str, serverError,
} from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';

// Public: exchange a one-time pairing code (from Admin → Devices) for a device token
export async function POST(req: NextRequest) {
  try {
    if (!(await rateLimit(`pair:${clientIp(req)}`, 10)) || !(await rateLimit('pair:all', 30))) {
      return jsonError('Too many attempts. Please wait a few minutes.', 429);
    }
    await connectToDatabase();

    const code = str((await req.json()).code, 6);
    if (!/^\d{6}$/.test(code)) return jsonError('Enter the 6-digit pairing code', 400);

    // Atomically consume the code so it can only pair one device
    const pairing = await PairingCodeModel.findOneAndUpdate(
      { codeHash: sha256(code), usedAt: null, expiresAt: { $gt: new Date() } },
      { usedAt: new Date() },
      { returnDocument: 'after' }
    );
    if (!pairing) return jsonError('Code is invalid or has expired', 401);

    const token = generateToken();
    const device = await DeviceModel.create({
      name: pairing.name,
      type: pairing.type,
      station: pairing.station ?? null,
      tokenHash: sha256(token),
      pairedBy: pairing.createdBy,
    });
    const data = { id: String(device._id), name: device.name, type: device.type, station: device.station ?? null, printStation: false };
    await audit(
      { user: null, device: data, sessionId: null, permissions: [], actorName: device.name },
      'device.paired',
      data.id,
      { pairedBy: pairing.createdBy }
    );
    return respondWithDevice(req, data, token);
  } catch (error) {
    return serverError(error);
  }
}

// Unpair the calling device (e.g. before handing the phone/terminal over)
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (auth.device) {
      await DeviceModel.updateOne({ _id: auth.device.id }, { revokedAt: new Date() });
      await revokeDeviceSessions(auth.device.id);
      await audit(auth, 'device.unpaired', auth.device.id);
    }
    const res = NextResponse.json({ success: true });
    clearDeviceCookie(res);
    clearSessionCookie(res);
    return res;
  } catch (error) {
    return serverError(error);
  }
}
