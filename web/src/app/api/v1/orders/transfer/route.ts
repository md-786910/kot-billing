import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { OrderModel } from '@/models/Order';
import { TableModel } from '@/models/Table';
import { KOTModel } from '@/models/KOT';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { orderId, fromTable, toTable, staff = 'Captain 1' } = body;

    if (!orderId || !fromTable || !toTable) {
      return NextResponse.json(
        { success: false, error: 'orderId, fromTable, and toTable are required' },
        { status: 400 }
      );
    }

    if (fromTable === toTable) {
      return NextResponse.json(
        { success: false, error: 'Source and target tables cannot be the same' },
        { status: 400 }
      );
    }

    // Check if target table is vacant
    const targetTableDoc = await TableModel.findOne({ name: toTable });
    if (!targetTableDoc) {
      return NextResponse.json(
        { success: false, error: `Target table ${toTable} does not exist` },
        { status: 404 }
      );
    }

    if (targetTableDoc.status === 'OCCUPIED' && targetTableDoc.currentOrderId) {
      return NextResponse.json(
        { success: false, error: `Target table ${toTable} is currently occupied` },
        { status: 400 }
      );
    }

    let order = null;
    if (mongoose.isValidObjectId(orderId)) {
      order = await OrderModel.findById(orderId);
    }
    if (!order) {
      order = await OrderModel.findOne({ orderNumber: orderId });
    }
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
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
