import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { DeviceModel, DEVICE_STATIONS, DEVICE_TYPES, DeviceStation, DeviceType } from '@/models/Device';
import { PairingCodeModel } from '@/models/PairingCode';
import { generatePairingCode, generateToken, sha256 } from '@/lib/auth/crypto';
import { audit, jsonError, requireAuth, respondWithDevice, revokeDeviceSessions, str, serverError } from '@/lib/auth';

const PAIRING_CODE_MINUTES = 10;

function parseDeviceInput(body: Record<string, unknown>): { name: string; type: DeviceType; station: DeviceStation | null } | string {
  const name = str(body.name, 40);
  // This product pairs counter terminals only (no waiter phones or station displays)
  const type = (str(body.type, 20) || 'TERMINAL') as DeviceType;
  const station = (str(body.station, 30) || null) as DeviceStation | null;
  if (!name) return 'Enter a device name';
  if (!DEVICE_TYPES.includes(type) || type !== 'TERMINAL') return 'Only counter terminals can be paired';
  if (type === 'DISPLAY' && (!station || !DEVICE_STATIONS.includes(station))) return 'Choose the station for this display';
  return { name, type, station: type === 'DISPLAY' ? station : null };
}

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'device.manage');
  if (!guard.ok) return guard.response;
  try {
    const devices = await DeviceModel.find({ revokedAt: null }).sort({ createdAt: 1 }).lean();
    return NextResponse.json({
      success: true,
      data: devices.map((d) => ({
        id: String(d._id),
        name: d.name,
        type: d.type,
        station: d.station ?? null,
        lastSeenAt: d.lastSeenAt ?? null,
        pairedBy: d.pairedBy ?? null,
        isCurrent: String(d._id) === guard.auth.device?.id,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}

// action 'pairing-code': one-time code to pair another device
// action 'register-this': pair the browser the admin is using right now
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, 'device.manage');
  if (!guard.ok) return guard.response;
  const { auth } = guard;
  try {
    const body = await req.json();
    const input = parseDeviceInput(body);
    if (typeof input === 'string') return jsonError(input, 400);

    if (body.action === 'pairing-code') {
      const code = generatePairingCode();
      const expiresAt = new Date(Date.now() + PAIRING_CODE_MINUTES * 60_000);
      await PairingCodeModel.create({ ...input, codeHash: sha256(code), createdBy: auth.actorName, expiresAt });
      await audit(auth, 'device.pairing_code', input.name, { type: input.type, station: input.station });
      return NextResponse.json({ success: true, data: { code, expiresAt } });
    }

    if (body.action === 'register-this') {
      if (auth.device) return jsonError('This device is already paired', 409);
      const token = generateToken();
      const device = await DeviceModel.create({ ...input, tokenHash: sha256(token), pairedBy: auth.actorName });
      await audit(auth, 'device.paired', String(device._id), { name: input.name, type: input.type });
      return respondWithDevice(req, { id: String(device._id), ...input }, token);
    }

    return jsonError('Unknown action', 400);
  } catch (error) {
    return serverError(error);
  }
}

// Rename or revoke a device. Revoking signs out everyone on it immediately.
export async function PATCH(req: NextRequest) {
  const guard = await requireAuth(req, 'device.manage');
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const id = str(body.id, 40);
    if (!mongoose.isValidObjectId(id)) return jsonError('Device not found', 404);
    const device = await DeviceModel.findOne({ _id: id, revokedAt: null });
    if (!device) return jsonError('Device not found', 404);

    if (body.revoke === true) {
      device.revokedAt = new Date();
      await device.save();
      await revokeDeviceSessions(id);
      await audit(guard.auth, 'device.revoked', id, { name: device.name });
      return NextResponse.json({ success: true });
    }

    const name = str(body.name, 40);
    if (!name) return jsonError('Enter a device name', 400);
    device.name = name;
    await device.save();
    await audit(guard.auth, 'device.renamed', id, { name });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
