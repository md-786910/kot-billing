import { NextRequest, NextResponse } from 'next/server';
import { SettingsModel } from '@/models/Settings';
import { audit, jsonError, requireAuth, serverError, str } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_RATES = [0, 5, 12, 18, 28];

function publicSettings(doc: Record<string, unknown> | null) {
  return {
    loungeName: doc?.loungeName ?? 'LAYALI SHISHA LOUNGE',
    tagline: doc?.tagline ?? '',
    address: doc?.address ?? '',
    phone: doc?.phone ?? '',
    gstNumber: doc?.gstNumber ?? '',
    taxPercent: doc?.taxPercent ?? 5,
    soundAlerts: doc?.soundAlerts ?? true,
    shishaDefaultDuration: doc?.shishaDefaultDuration ?? 45,
    upiId: doc?.upiId ?? '',
    kotStaffCopy: doc?.kotStaffCopy ?? true,
    kotAdminCopy: doc?.kotAdminCopy ?? true,
  };
}

// Lounge details printed on every bill and KOT; readable by any signed-in staff member
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
  try {
    const doc = await SettingsModel.findOne().lean();
    return NextResponse.json({ success: true, data: publicSettings(doc as unknown as Record<string, unknown> | null) });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAuth(req, 'settings.manage');
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const update: Record<string, unknown> = {};

    if (body.loungeName !== undefined) {
      const v = str(body.loungeName, 80);
      if (!v) return jsonError('Enter the lounge name (up to 80 characters)', 400);
      update.loungeName = v;
    }
    for (const [key, max] of [['tagline', 80], ['address', 200], ['phone', 30], ['upiId', 60]] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string' || body[key].trim().length > max) return jsonError(`${key} is too long`, 400);
        update[key] = body[key].trim();
      }
    }
    if (body.gstNumber !== undefined) {
      const v = typeof body.gstNumber === 'string' ? body.gstNumber.trim().toUpperCase() : '';
      if (v && !GSTIN_PATTERN.test(v)) return jsonError('GSTIN must be the 15-character number on your GST certificate', 400);
      update.gstNumber = v;
    }
    if (body.taxPercent !== undefined) {
      const v = Number(body.taxPercent);
      if (!GST_RATES.includes(v)) return jsonError(`GST rate must be one of ${GST_RATES.join(', ')}%`, 400);
      update.taxPercent = v;
    }
    if (body.shishaDefaultDuration !== undefined) {
      const v = Number(body.shishaDefaultDuration);
      if (!Number.isInteger(v) || v < 15 || v > 180) return jsonError('Shisha time must be 15–180 minutes', 400);
      update.shishaDefaultDuration = v;
    }
    if (body.soundAlerts !== undefined) update.soundAlerts = body.soundAlerts === true;
    // The station copy always prints; staff and admin copies are optional
    if (body.kotStaffCopy !== undefined) update.kotStaffCopy = body.kotStaffCopy === true;
    if (body.kotAdminCopy !== undefined) update.kotAdminCopy = body.kotAdminCopy === true;

    const doc = await SettingsModel.findOneAndUpdate({}, { $set: update }, { upsert: true, returnDocument: 'after' }).lean();
    await audit(guard.auth, 'settings.updated', null, update);
    broadcastRealtimeEvent('SETTINGS_UPDATED');
    return NextResponse.json({ success: true, data: publicSettings(doc as unknown as Record<string, unknown> | null) });
  } catch (error) {
    return serverError(error);
  }
}
