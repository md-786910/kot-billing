import { NextRequest, NextResponse } from 'next/server';
import { queueCancel } from '@/lib/printQueue';
import { audit, authorizeOrApprove, requireAuth } from '@/lib/auth';
import { nextKotNumber } from '@/lib/orders';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { OrderModel } from '@/models/Order';
import { KOTModel } from '@/models/KOT';
import { TableModel } from '@/models/Table';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, 'order.create');
  if (!guard.ok) return guard.response;
  const { auth } = guard;
  try {
    await connectToDatabase();
    const body = await req.json();
    const { orderId, itemIndex, voidQty, voidEntireOrder = false, voidReason, pin } = body;

    if (!orderId || !voidReason) {
      return NextResponse.json(
        { success: false, error: 'orderId and voidReason are required' },
        { status: 400 }
      );
    }

    if (!voidEntireOrder && itemIndex === undefined) {
      return NextResponse.json(
        { success: false, error: 'itemIndex or voidEntireOrder is required' },
        { status: 400 }
      );
    }

    // Voids need a manager, or a manager's PIN entered on this device
    const approval = await authorizeOrApprove(req, auth, 'order.void', pin);
    if (!approval.ok) return approval.response;
    const staff = approval.approvedBy ? `${auth.actorName} (approved by ${approval.approvedBy})` : auth.actorName;

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
    if (order.closed) {
      return NextResponse.json({ success: false, error: 'This bill is already closed' }, { status: 409 });
    }
    if (!voidEntireOrder) {
      if (!Number.isInteger(itemIndex) || !order.items[itemIndex]) {
        return NextResponse.json({ success: false, error: 'Item not found at index' }, { status: 400 });
      }
      if (order.items[itemIndex].isVoided) {
        return NextResponse.json({ success: false, error: 'This item is already voided' }, { status: 409 });
      }
    }
    await audit(auth, voidEntireOrder ? 'order.voided' : 'order.item_voided', order.orderNumber, {
      itemIndex, voidQty, voidReason: String(voidReason),
    }, approval.approvedBy);

    // 1. Full Table / Entire Order Cancellation
    if (voidEntireOrder) {
      order.status = 'VOIDED';
      order.closed = true;
      order.closedAt = new Date();
      order.notes = (order.notes ? order.notes + ' | ' : '') + `ORDER CANCELLED: ${voidReason}`;

      order.items.forEach((it) => {
        if (!it.isVoided) {
          it.isVoided = true;
          it.voidReason = voidReason;
          it.voidedAt = new Date();
          it.voidedBy = staff;
        }
      });

      await order.save();

      // Free the table
      await TableModel.updateOne(
        { name: order.tableName },
        { status: 'VACANT', currentOrderId: null }
      );
      broadcastRealtimeEvent('TABLE_STATUS_CHANGED', { name: order.tableName, status: 'VACANT' });

      // Cancel all active KOTs for this order
      await KOTModel.updateMany(
        { orderId: order._id.toString(), status: { $in: ['NEW', 'PREPARING'] } },
        { status: 'CANCELLED', notes: `ORDER CANCELLED: ${voidReason}` }
      );

      // Create an overall VOID docket
      const voidKotNumber = await nextKotNumber('VOID');
      const voidKot = await KOTModel.create({
        kotNumber: voidKotNumber,
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        tableName: order.tableName,
        guestName: order.guestName,
        station: 'Kitchen',
        items: [{
          name: `[FULL ORDER VOID] #${order.orderNumber}`,
          price: 0,
          qty: 1,
          notes: `REASON: ${voidReason}`,
        }],
        notes: `FULL TABLE ORDER CANCELLED (${order.tableName}) - REASON: ${voidReason}`,
        status: 'CANCELLED',
      });

      broadcastRealtimeEvent('ORDER_UPDATED', { order: order.toObject() });
      // Paper cancel slip for the station
      await queueCancel(voidKot, auth);
      broadcastRealtimeEvent('KOT_CREATED', voidKot.toObject());

      return NextResponse.json({
        success: true,
        message: `Entire order #${order.orderNumber} voided and ${order.tableName} released to VACANT.`,
        data: order,
        voidKot,
      });
    }

    // 2. Individual Line Item Void (with Partial Qty support)

    const targetItem = order.items[itemIndex];
    const qtyToVoid = (voidQty && Number(voidQty) > 0 && Number(voidQty) < targetItem.qty)
      ? Number(voidQty)
      : targetItem.qty;

    if (qtyToVoid < targetItem.qty) {
      // Partial reduction: decrement original item qty
      targetItem.qty -= qtyToVoid;
      // Add separate voided record for financial & audit tracking
      order.items.push({
        name: targetItem.name,
        price: targetItem.price,
        station: targetItem.station,
        category: targetItem.category,
        qty: qtyToVoid,
        notes: targetItem.notes,
        isVoided: true,
        voidReason,
        voidedAt: new Date(),
        voidedBy: staff,
      });
    } else {
      // Full item row void
      targetItem.isVoided = true;
      targetItem.voidReason = voidReason;
      targetItem.voidedAt = new Date();
      targetItem.voidedBy = staff;
    }

    await order.save();

    // Create a VOID docket in KOT system so kitchen/station knows immediately
    const voidKotNumber = await nextKotNumber('VOID');
    const voidKot = await KOTModel.create({
      kotNumber: voidKotNumber,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      tableName: order.tableName,
      guestName: order.guestName,
      station: targetItem.station,
      items: [{
        name: `[VOID CANCEL] ${targetItem.name}`,
        price: targetItem.price,
        qty: qtyToVoid,
        notes: `REASON: ${voidReason}`,
      }],
      notes: `CANCELLED ITEM VOID DOCKET: ${targetItem.name} (${qtyToVoid}x)`,
      status: 'CANCELLED',
    });

    broadcastRealtimeEvent('ORDER_UPDATED', { order: order.toObject() });
    // Paper cancel slip for the station
    await queueCancel(voidKot, auth);
    broadcastRealtimeEvent('KOT_CREATED', voidKot.toObject());

    return NextResponse.json({
      success: true,
      message: `Voided ${qtyToVoid}x ${targetItem.name} successfully.`,
      data: order,
      voidKot,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
