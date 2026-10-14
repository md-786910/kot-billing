import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { DeviceModel, DeviceStation, DeviceType } from '@/models/Device';
import { PairingCodeModel } from '@/models/PairingCode';
import { generatePairingCode, generateToken, sha256 } from '@/lib/auth/crypto';
import { audit, jsonError, requireAuth, respondWithDevice, revokeDeviceSessions, str, serverError } from '@/lib/auth';

const PAIRING_CODE_MINUTES = 10;

// Counter computers and staff phones; station displays are not part of this product
const PAIRABLE: DeviceType[] = ['TERMINAL', 'MOBILE'];

function parseDeviceInput(body: Record<string, unknown>): { name: string; type: DeviceType; station: DeviceStation | null } | string {
  const name = str(body.name, 40);
  const type = (str(body.type, 20) || 'TERMINAL') as DeviceType;
  if (!name) return 'Enter a device name';
  if (!PAIRABLE.includes(type)) return 'Choose counter computer or staff phone';
  return { name, type, station: null };
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
        printStation: !!d.printStation,
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

    // One counter computer prints for everyone
    if (body.printStation !== undefined) {
      if (body.printStation === true && device.type !== 'TERMINAL') return jsonError('Only a counter computer can print', 400);
      if (body.printStation === true) await DeviceModel.updateMany({ _id: { $ne: id } }, { printStation: false });
      device.printStation = body.printStation === true;
      if (device.printStation) device.lastSeenAt = new Date();
      await device.save();
      await audit(guard.auth, 'device.print_station', id, { name: device.name, printStation: device.printStation });
      return NextResponse.json({ success: true });
    }

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
