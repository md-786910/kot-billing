import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { jsonError, requireAuth, serverError, str } from '@/lib/auth';
import { OrderModel } from '@/models/Order';
import { KOTModel } from '@/models/KOT';
import { ShiftRegisterModel } from '@/models/ShiftRegister';
import { PrivateBookingModel } from '@/models/PrivateBooking';
import { PrintJobModel } from '@/models/PrintJob';
import { printStationStatus, queueBill, queueCancel, queueKots, queueZReport } from '@/lib/printQueue';
import type { BillPrint } from '@/lib/print/templates';

/** Recent print jobs and whether the counter printer is online (shown on every terminal and phone) */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
  try {
    const since = new Date(Date.now() - 12 * 3600_000);
    const jobs = await PrintJobModel.find({ createdAt: { $gte: since } })
      .select('kind label status requestedBy requestedFrom attempts error createdAt printedAt')
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();
    const waiting = jobs.filter((j) => j.status === 'PENDING' || j.status === 'PRINTING');
    return NextResponse.json({
      success: true,
      data: {
        station: await printStationStatus(),
        pending: waiting.length,
        // Oldest job still waiting, so clients can warn when the printer stops printing
        oldestPendingAt: waiting.length ? waiting[waiting.length - 1].createdAt : null,
        failed: jobs.filter((j) => j.status === 'FAILED').length,
        jobs: jobs.map((j) => ({ ...j, id: String(j._id), _id: undefined })),
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

/** Booking room charge as billed on screen ({venue, rate, hours, advance}); falls back to the booking itself */
async function bookingFor(order: { bookingId?: string | null }, body: Record<string, unknown>): Promise<BillPrint['booking']> {
  const b = body.booking as Record<string, unknown> | undefined;
  if (b && typeof b.venue === 'string' && [b.rate, b.hours, b.advance].every((v) => Number.isFinite(Number(v)))) {
    return { venue: b.venue.slice(0, 40), rate: Number(b.rate), hours: Number(b.hours), advance: Number(b.advance) };
  }
  if (!order.bookingId) return null;
  const doc = mongoose.isValidObjectId(order.bookingId)
    ? await PrivateBookingModel.findById(order.bookingId).lean()
    : await PrivateBookingModel.findOne({ bookingNumber: order.bookingId }).lean();
  return doc ? { venue: doc.venue, rate: doc.rate, hours: doc.hours, advance: doc.advance } : null;
}

/**
 * Ask the counter printer for a slip:
 *   { kind: 'bill', orderId, booking? } · { kind: 'kot', kotId } (reprint) · { kind: 'zreport', shiftId } · { kind: 'retry', jobId }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kind = str(body.kind, 10);
    const permission = kind === 'bill' ? 'bill.settle' : kind === 'zreport' ? 'shift.manage' : 'order.create';
    const guard = await requireAuth(req, permission);
    if (!guard.ok) return guard.response;
    const { auth } = guard;

    if (kind === 'bill') {
      const id = str(body.orderId, 40);
      const order = mongoose.isValidObjectId(id) ? await OrderModel.findById(id).lean() : await OrderModel.findOne({ orderNumber: id }).lean();
      if (!order) return jsonError('Order not found', 404);
      const job = await queueBill(order, await bookingFor(order, body), auth);
      return NextResponse.json({ success: !!job, data: { id: job ? String(job._id) : null } }, { status: job ? 200 : 500 });
    }

    if (kind === 'kot') {
      const id = str(body.kotId, 40);
      const kot = mongoose.isValidObjectId(id) ? await KOTModel.findById(id).lean() : await KOTModel.findOne({ kotNumber: id }).lean();
      if (!kot) return jsonError('KOT not found', 404);
      const isCancel = kot.status === 'CANCELLED' || kot.kotNumber.startsWith('VOID-');
      const job = isCancel ? await queueCancel(kot, auth) : await queueKots([kot], auth);
      return NextResponse.json({ success: !!job, data: { id: job ? String(job._id) : null } }, { status: job ? 200 : 500 });
    }

    if (kind === 'zreport') {
      const id = str(body.shiftId, 40);
      const shift = mongoose.isValidObjectId(id) ? await ShiftRegisterModel.findById(id).lean() : await ShiftRegisterModel.findOne({ shiftNumber: id }).lean();
      if (!shift) return jsonError('Shift not found', 404);
      const job = await queueZReport(shift, auth);
      return NextResponse.json({ success: !!job, data: { id: job ? String(job._id) : null } }, { status: job ? 200 : 500 });
    }

    if (kind === 'retry') {
      const id = str(body.jobId, 40);
      if (!mongoose.isValidObjectId(id)) return jsonError('Print job not found', 404);
      const job = await PrintJobModel.findOneAndUpdate(
        { _id: id, status: { $in: ['FAILED', 'PRINTED'] } },
        { status: 'PENDING', claimedBy: null, claimedAt: null, attempts: 0, error: '' },
        { returnDocument: 'after' }
      );
      if (!job) return jsonError('This job is already waiting to print', 409);
      return NextResponse.json({ success: true, data: { id } });
    }

    return jsonError('Unknown print request', 400);
  } catch (error) {
    return serverError(error);
  }
}
