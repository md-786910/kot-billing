import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { KOTModel } from '@/models/KOT';
import { broadcastRealtimeEvent } from '@/lib/realtime';


export async function GET(req: NextRequest) {
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
  try {
    await connectToDatabase();
    const body = await req.json();
    const { kotId, status } = body;

    const updateFields: any = { status };
    if (status === 'PREPARING') updateFields.startedAt = new Date();
    if (status === 'READY') updateFields.readyAt = new Date();
    if (status === 'SERVED') updateFields.servedAt = new Date();

    const query = mongoose.isValidObjectId(kotId) ? { _id: kotId } : { kotNumber: kotId };
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
