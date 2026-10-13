import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, str } from '@/lib/auth';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { KOTModel } from '@/models/KOT';
import { broadcastRealtimeEvent } from '@/lib/realtime';

const FLOW = ['NEW', 'PREPARING', 'READY', 'SERVED'];
const KOT_STATUSES = [...FLOW, 'CANCELLED'];


export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const station = searchParams.get('station');
    const status = searchParams.get('status');

    const filter: any = {};
    if (station && station !== 'All') filter.station = station;

    if (status === 'ACTIVE_ALL') {
      filter.status = { $ne: 'SERVED' };
    } else if (status === 'RECENT') {
      // Open tickets plus anything finished in the last 3 hours (phone "Done" view)
      filter.$or = [
        { status: { $in: ['NEW', 'PREPARING', 'READY'] } },
        { createdAt: { $gte: new Date(Date.now() - 3 * 3600_000) } },
      ];
    } else if (status && status !== 'All') {
      filter.status = status;
    }

    const kots = await KOTModel.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: kots });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAuth(req, 'kot.update');
  if (!guard.ok) return guard.response;
  const { auth } = guard;
  try {
    await connectToDatabase();
    const body = await req.json();
    const { kotId, status } = body;
    if (!KOT_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid KOT status' }, { status: 400 });
    }

    const updateFields: any = { status };
    if (status === 'PREPARING') updateFields.startedAt = new Date();
    if (status === 'READY') updateFields.readyAt = new Date();
    if (status === 'SERVED') updateFields.servedAt = new Date();

    // Tickets only move forward (NEW → PREPARING → READY → SERVED); cancelling needs void rights
    let allowedFrom: string[];
    if (status === 'CANCELLED') {
      if (!auth.permissions.includes('order.void')) {
        return NextResponse.json({ success: false, error: 'You do not have permission for this action' }, { status: 403 });
      }
      allowedFrom = ['NEW', 'PREPARING', 'READY'];
    } else {
      allowedFrom = FLOW.slice(0, FLOW.indexOf(status));
    }

    const key = str(kotId, 40);
    const match: Record<string, unknown> = mongoose.isValidObjectId(key) ? { _id: key } : { kotNumber: key };
    if (auth.device?.type === 'DISPLAY' && !auth.user) match.station = auth.device.station;
    const forwardOnly: Record<string, unknown> = { ...match, status: { $in: allowedFrom } };
    const updated = await KOTModel.findOneAndUpdate(
      forwardOnly,
      { $set: updateFields },
      { returnDocument: 'after' }
    ).lean();

    if (!updated) {
      const current = await KOTModel.findOne(match).select('status').lean();
      return current
        ? NextResponse.json({ success: false, error: `Ticket is already ${current.status}` }, { status: 409 })
        : NextResponse.json({ success: false, error: 'KOT not found' }, { status: 404 });
    }

    broadcastRealtimeEvent('KOT_STATUS_CHANGED', updated);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
