import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getAuth, jsonError, serverError, str } from '@/lib/auth';
import { DeviceModel } from '@/models/Device';
import { PrintJobModel } from '@/models/PrintJob';

const CLAIM_BATCH = 5;
/** A job claimed this long ago without an answer goes back to the queue (station crashed or closed) */
const RECLAIM_AFTER_MS = 2 * 60_000;
const MAX_ATTEMPTS = 3;

/**
 * The print station polls here for jobs. It authenticates with its device token alone, so it keeps
 * printing while the counter screen is locked between staff.
 */
async function stationDevice(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth.device?.printStation) return null;
  // "Online" heartbeat; written at most every 10 s, not on every poll
  await DeviceModel.updateOne(
    { _id: auth.device.id, $or: [{ lastSeenAt: null }, { lastSeenAt: { $lt: new Date(Date.now() - 10_000) } }] },
    { lastSeenAt: new Date() }
  );
  return auth.device;
}

export async function POST(req: NextRequest) {
  try {
    const device = await stationDevice(req);
    if (!device) return jsonError('This computer is not the print station', 403);

    // Jobs that keep failing stop retrying and show as failed (reprint from the queue)
    await PrintJobModel.updateMany(
      { status: 'PRINTING', attempts: { $gte: MAX_ATTEMPTS }, claimedAt: { $lt: new Date(Date.now() - RECLAIM_AFTER_MS) } },
      { status: 'FAILED', error: 'Printer did not confirm' }
    );

    const jobs = [];
    for (let i = 0; i < CLAIM_BATCH; i++) {
      const job = await PrintJobModel.findOneAndUpdate(
        {
          $or: [
            { status: 'PENDING' },
            { status: 'PRINTING', claimedAt: { $lt: new Date(Date.now() - RECLAIM_AFTER_MS) }, attempts: { $lt: MAX_ATTEMPTS } },
          ],
        },
        { status: 'PRINTING', claimedBy: device.id, claimedAt: new Date(), $inc: { attempts: 1 } },
        { sort: { createdAt: 1 }, returnDocument: 'after' }
      ).lean();
      if (!job) break;
      jobs.push({ id: String(job._id), kind: job.kind, label: job.label, payload: job.payload });
    }
    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    return serverError(error);
  }
}

/** The station reports each job: { id, ok, error? } */
export async function PATCH(req: NextRequest) {
  try {
    const device = await stationDevice(req);
    if (!device) return jsonError('This computer is not the print station', 403);
    const body = await req.json();
    const id = str(body.id, 40);
    if (!mongoose.isValidObjectId(id)) return jsonError('Print job not found', 404);
    const update = body.ok === true
      ? { status: 'PRINTED', printedAt: new Date(), error: '' }
      : { status: 'FAILED', error: str(body.error, 200) || 'Print failed' };
    const job = await PrintJobModel.findOneAndUpdate({ _id: id, claimedBy: device.id }, update, { returnDocument: 'after' });
    if (!job) return jsonError('Print job not found', 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
