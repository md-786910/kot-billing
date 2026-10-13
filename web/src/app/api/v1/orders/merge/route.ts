import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { OrderModel } from '@/models/Order';
import { KOTModel } from '@/models/KOT';
import { TableModel } from '@/models/Table';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, 'table.move');
  if (!guard.ok) return guard.response;
  const { auth } = guard;
  try {
    await connectToDatabase();
    const body = await req.json();
    const { sourceTable, targetTable, reason = 'Party merged seating' } = body;
    const staff = auth.actorName;

    if (!sourceTable || !targetTable) {
      return NextResponse.json(
        { success: false, error: 'sourceTable and targetTable are required' },
        { status: 400 }
      );
    }

    if (sourceTable === targetTable) {
      return NextResponse.json(
        { success: false, error: 'Cannot merge a table into itself.' },
        { status: 400 }
      );
    }

    // Find active orders on both tables
    const sourceOrder = await OrderModel.findOne({ tableName: sourceTable, closed: false });
    if (!sourceOrder) {
      return NextResponse.json(
        { success: false, error: `No active order found on source ${sourceTable}` },
        { status: 404 }
      );
    }

    const targetOrder = await OrderModel.findOne({ tableName: targetTable, closed: false });
    if (!targetOrder) {
      return NextResponse.json(
        { success: false, error: `No active order found on target ${targetTable}` },
        { status: 404 }
      );
    }

    // 1. Move items from source to target
    targetOrder.items.push(...sourceOrder.items);
    targetOrder.shishaAdvance = (targetOrder.shishaAdvance || 0) + (sourceOrder.shishaAdvance || 0);
    targetOrder.payments.push(...sourceOrder.payments);
    if (!targetOrder.bookingId && sourceOrder.bookingId) targetOrder.bookingId = sourceOrder.bookingId;
    targetOrder.notes = (targetOrder.notes ? targetOrder.notes + ' | ' : '') +
      `MERGED with ${sourceTable} (#${sourceOrder.orderNumber}) by ${staff}: ${reason}`;

    await targetOrder.save();

    // 2. Reassign station KOTs from sourceOrder to targetOrder and targetTable
    await KOTModel.updateMany(
      { orderId: sourceOrder._id.toString() },
      {
        $set: {
          tableName: targetTable,
          orderId: targetOrder._id.toString(),
          orderNumber: targetOrder.orderNumber,
        },
      }
    );

    // 3. Close sourceOrder as Merged (its items and payments now live on the target bill)
    sourceOrder.status = 'MERGED';
    sourceOrder.closed = true;
    sourceOrder.closedAt = new Date();
    sourceOrder.notes = (sourceOrder.notes ? sourceOrder.notes + ' | ' : '') +
      `MERGED into ${targetTable} (#${targetOrder.orderNumber}) by ${staff}`;
    await sourceOrder.save();

    // 4. Free sourceTable to VACANT
    await TableModel.updateOne(
      { name: sourceTable },
      { $set: { status: 'VACANT', currentOrderId: null } }
    );

    // 5. Broadcast real-time events
    broadcastRealtimeEvent('TABLE_STATUS_CHANGED', { name: sourceTable, status: 'VACANT' });
    broadcastRealtimeEvent('ORDER_UPDATED', { order: targetOrder.toObject() });
    broadcastRealtimeEvent('TABLE_MERGED', {
      fromTable: sourceTable,
      toTable: targetTable,
      targetOrder: targetOrder.toObject(),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${sourceTable} (#${sourceOrder.orderNumber}) into ${targetTable} (#${targetOrder.orderNumber}).`,
      data: targetOrder,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
