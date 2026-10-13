import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, str } from '@/lib/auth';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { KOTModel } from '@/models/KOT';
import { broadcastRealtimeEvent } from '@/lib/realtime';

const KOT_STATUSES = ['NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];


export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
  const { auth } = guard;
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const station = searchParams.get('station');
    const status = searchParams.get('status');

    const filter: any = {};
    if (station && station !== 'All') filter.station = station;

    if (status === 'ACTIVE_ALL') {
      filter.status = { $ne: 'SERVED' };
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

    const key = str(kotId, 40);
    const query: Record<string, unknown> = mongoose.isValidObjectId(key) ? { _id: key } : { kotNumber: key };
    if (auth.device?.type === 'DISPLAY' && !auth.user) query.station = auth.device.station;
    const updated = await KOTModel.findOneAndUpdate(
      query,
      { $set: updateFields },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'KOT not found' }, { status: 404 });
    }

    broadcastRealtimeEvent('KOT_STATUS_CHANGED', updated);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
