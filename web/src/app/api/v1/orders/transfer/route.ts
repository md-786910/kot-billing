import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, str } from '@/lib/auth';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { OrderModel } from '@/models/Order';
import { TableModel } from '@/models/Table';
import { KOTModel } from '@/models/KOT';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, 'table.move');
  if (!guard.ok) return guard.response;
  const { auth } = guard;
  try {
    await connectToDatabase();
    const body = await req.json();
    const orderId = str(body.orderId, 40);
    const toTable = str(body.toTable, 60);
    const staff = auth.actorName;
    if (!orderId || !toTable) {
      return NextResponse.json({ success: false, error: 'orderId and toTable are required' }, { status: 400 });
    }

    const order = mongoose.isValidObjectId(orderId)
      ? await OrderModel.findById(orderId)
      : await OrderModel.findOne({ orderNumber: orderId });
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    if (order.closed) return NextResponse.json({ success: false, error: 'This bill is already closed' }, { status: 409 });
    // The order's own table is the source; a client-sent "fromTable" is never trusted
    const fromTable = order.tableName;
    if (fromTable === toTable) {
      return NextResponse.json({ success: false, error: 'Source and target tables cannot be the same' }, { status: 400 });
    }
    if (!(await TableModel.exists({ name: toTable }))) {
      return NextResponse.json({ success: false, error: `Target table ${toTable} does not exist` }, { status: 404 });
    }
    if (await OrderModel.exists({ tableName: toTable, closed: false })) {
      return NextResponse.json({ success: false, error: `Target table ${toTable} is currently occupied` }, { status: 409 });
    }

    // Record transfer in history
    order.tableTransferHistory.push({
      fromTable,
      toTable,
      timestamp: new Date(),
      staff,
    });
    order.tableName = toTable;
    await order.save();

    // Free the old table
    await TableModel.updateOne(
      { name: fromTable },
      { status: 'VACANT', currentOrderId: null }
    );

    // Occupy the new table
    await TableModel.updateOne(
      { name: toTable },
      { status: 'OCCUPIED', currentOrderId: order._id.toString() }
    );

    // Update table location on any active KOTs
    await KOTModel.updateMany(
      { $or: [{ orderId: order._id.toString() }, { orderNumber: order.orderNumber }] },
      { $set: { tableName: toTable } }
    );

    broadcastRealtimeEvent('TABLE_STATUS_CHANGED', { name: fromTable, status: 'VACANT' });
    broadcastRealtimeEvent('TABLE_STATUS_CHANGED', { name: toTable, status: 'OCCUPIED' });
    broadcastRealtimeEvent('ORDER_UPDATED', { order: order.toObject() });

    return NextResponse.json({
      success: true,
      message: `Table transferred from ${fromTable} to ${toTable} successfully.`,
      data: order,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
