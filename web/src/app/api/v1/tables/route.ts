import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAuth, str } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { TableModel } from '@/models/Table';
import { broadcastRealtimeEvent } from '@/lib/realtime';


export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
  try {
    await connectToDatabase();
    // Fast lean query with projection
    const tables = await TableModel.find().sort({ name: 1 }).lean();
    return NextResponse.json({ success: true, data: tables });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAuth(req, 'table.update');
  if (!guard.ok) return guard.response;
  try {
    await connectToDatabase();
    const body = await req.json();
    const { id, name, status, currentOrderId } = body;

    const tableId = str(id, 40);
    if (id !== undefined && !mongoose.isValidObjectId(tableId)) {
      return NextResponse.json({ success: false, error: 'Table not found' }, { status: 404 });
    }
    const query = id !== undefined ? { _id: tableId } : { name: str(name, 60) };
    const updated = await TableModel.findOneAndUpdate(
      query,
      { $set: { ...(status && { status }), ...(currentOrderId !== undefined && { currentOrderId }) } },
      { returnDocument: 'after' }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Table not found' }, { status: 404 });
    }

    broadcastRealtimeEvent('TABLE_STATUS_CHANGED', updated);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
