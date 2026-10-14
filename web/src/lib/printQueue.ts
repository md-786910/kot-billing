/* eslint-disable @typescript-eslint/no-explicit-any -- accepts Mongoose documents */
import type { AuthContext } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { PrintJobModel } from '@/models/PrintJob';
import { DeviceModel } from '@/models/Device';
import { SettingsModel } from '@/models/Settings';
import { describePrintJob, PrintPayload } from '@/lib/print/render';
import { toBillPrint, toKotPrint, toPrintSettings, toZReportPrint } from '@/lib/print/adapters';
import type { BillPrint, KotCopy } from '@/lib/print/templates';

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

/** Copies each KOT prints: the station copy always, then staff and admin copies if the lounge wants them */
async function kotCopies(): Promise<KotCopy[]> {
  const s = await SettingsModel.findOne().select('kotStaffCopy kotAdminCopy').lean();
  const copies: KotCopy[] = ['STATION'];
  if (s?.kotStaffCopy ?? true) copies.push('STAFF');
  if (s?.kotAdminCopy ?? true) copies.push('ADMIN');
  return copies;
}

/** New KOTs print every copy; a reprint (lost ticket) prints one station copy marked REPRINT */
export async function queueKots(kots: any[], auth: AuthContext | null, opts: { reprint?: boolean } = {}) {
  if (!kots.length) return null;
  const copies: KotCopy[] = opts.reprint ? ['STATION'] : await kotCopies();
  return enqueue({ kind: 'kot', kots: kots.map(toKotPrint), copies, reprint: opts.reprint }, auth);
}

export async function queueCancel(voidKot: any, auth: AuthContext | null, opts: { reprint?: boolean } = {}) {
  const copies: KotCopy[] = opts.reprint ? ['STATION'] : await kotCopies();
  return enqueue({ kind: 'cancel', kot: toKotPrint(voidKot), copies, reprint: opts.reprint }, auth);
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
