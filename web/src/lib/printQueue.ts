/* eslint-disable @typescript-eslint/no-explicit-any -- accepts Mongoose documents */
import type { AuthContext } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { PrintJobModel } from '@/models/PrintJob';
import { DeviceModel } from '@/models/Device';
import { SettingsModel } from '@/models/Settings';
import { describePrintJob, PrintPayload } from '@/lib/print/render';
import { toBillPrint, toKotPrint, toPrintSettings, toZReportPrint } from '@/lib/print/adapters';
import type { BillPrint } from '@/lib/print/templates';

/** A print station that hasn't polled for this long is shown as offline */
export const STATION_OFFLINE_MS = 30_000;

/**
 * Queue a slip for the counter's print station. Printing never blocks or fails the action that caused it:
 * if queueing fails it is logged and can be reprinted from the KOT log / bill screen.
 */
async function enqueue(payload: PrintPayload, auth: AuthContext | null) {
  try {
    const job = await PrintJobModel.create({
      kind: payload.kind,
      payload,
      label: describePrintJob(payload),
      requestedBy: auth?.actorName,
      requestedFrom: auth?.device?.name,
    });
    broadcastRealtimeEvent('PRINT_JOB', { id: String(job._id), label: job.label });
    return job;
  } catch (error) {
    console.error('Print queue error:', error);
    return null;
  }
}

async function settingsSnapshot() {
  return toPrintSettings(await SettingsModel.findOne().lean());
}

export function queueKots(kots: any[], auth: AuthContext | null) {
  if (!kots.length) return Promise.resolve(null);
  return enqueue({ kind: 'kot', kots: kots.map(toKotPrint) }, auth);
}

export function queueCancel(voidKot: any, auth: AuthContext | null) {
  return enqueue({ kind: 'cancel', kot: toKotPrint(voidKot) }, auth);
}

export async function queueBill(order: any, booking: BillPrint['booking'] | undefined, auth: AuthContext | null) {
  return enqueue({ kind: 'bill', bill: toBillPrint(order, booking), settings: await settingsSnapshot() }, auth);
}

export async function queueZReport(shift: any, auth: AuthContext | null) {
  return enqueue({ kind: 'zreport', zreport: toZReportPrint(shift), settings: await settingsSnapshot() }, auth);
}

/** Which device prints, and whether it has checked in recently */
export async function printStationStatus() {
  const station = await DeviceModel.findOne({ printStation: true, revokedAt: null }).select('name lastSeenAt').lean();
  if (!station) return { configured: false, online: false, name: null as string | null };
  const online = !!station.lastSeenAt && Date.now() - new Date(station.lastSeenAt).getTime() < STATION_OFFLINE_MS;
  return { configured: true, online, name: station.name };
}
