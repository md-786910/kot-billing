import { NextRequest, NextResponse } from 'next/server';
import { queueKots } from '@/lib/printQueue';
import { AuthContext, requireAuth, serverError, str } from '@/lib/auth';
import { createStationKots, isDuplicateKey, nextOrderNumber, priceItems } from '@/lib/orders';
import { withIdempotency } from '@/lib/idempotency';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { OrderModel } from '@/models/Order';
import { TableModel } from '@/models/Table';
import { broadcastRealtimeEvent } from '@/lib/realtime';


export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'open';

    const filter: any = {};
    if (status === 'open') filter.closed = false;
    else if (status === 'closed') filter.closed = true;

    const orders = await OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: orders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Retried punches (double tap, timeout after the server saved) carry the same idempotencyKey and never duplicate KOTs
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, 'order.create');
  if (!guard.ok) return guard.response;
  return withIdempotency(req, guard.auth, () => createOrder(req, guard.auth));
}

async function createOrder(req: NextRequest, auth: AuthContext) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const tableName = str(body.tableName, 60);
    if (!tableName) return NextResponse.json({ success: false, error: 'Select a table' }, { status: 400 });
    if (!(await TableModel.exists({ name: tableName }))) {
      return NextResponse.json({ success: false, error: `${tableName} does not exist` }, { status: 404 });
    }
    const priced = await priceItems(body.items);
    if ('error' in priced) return NextResponse.json({ success: false, error: priced.error }, { status: priced.status });
    const { items } = priced;

    const guestName = str(body.guestName, 80);
    const guestPhone = str(body.guestPhone, 20);
    const bookingId = str(body.bookingId, 40) || null;
    const notes = str(body.notes, 500);
    const duration = Number(body.duration) > 0 ? Math.min(Number(body.duration), 600) : 45;

    // A table has one running bill: append to it, or open it. The unique index settles simultaneous first punches.
    let order = await OrderModel.findOne({ tableName, closed: false });
    let appended = !!order;
    if (!order) {
      try {
        order = await OrderModel.create({
          orderNumber: await nextOrderNumber(),
          tableName,
          guestName,
          guestPhone,
          staffName: auth.actorName,
          bookingId,
          status: 'OPEN',
          items,
          notes,
          shishaAdvance: Math.max(0, Number(body.shishaAdvance) || 0),
          duration,
          taxPercent: Number(body.taxPercent) >= 0 ? Number(body.taxPercent) : 5,
          discountAmount: 0,
          payments: [],
          closed: false,
        });
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        order = await OrderModel.findOne({ tableName, closed: false });
        if (!order) throw error;
        appended = true;
      }
    }
    if (appended) {
      order.items.push(...items);
      if (guestName && !order.guestName) order.guestName = guestName;
      if (guestPhone && !order.guestPhone) order.guestPhone = guestPhone;
      if (bookingId && !order.bookingId) order.bookingId = bookingId;
      await order.save();
    }

    await TableModel.updateOne({ name: tableName }, { status: 'OCCUPIED', currentOrderId: order._id.toString() });
    const kots = await createStationKots(order, items, notes, duration);
    await queueKots(kots, auth);

    broadcastRealtimeEvent(appended ? 'ORDER_UPDATED' : 'ORDER_CREATED', { order: order.toObject(), kots });
    broadcastRealtimeEvent('TABLE_STATUS_CHANGED', { name: tableName, status: 'OCCUPIED' });
    for (const k of kots) broadcastRealtimeEvent('KOT_CREATED', k);

    return NextResponse.json({ success: true, data: { order, kots, appendedToExisting: appended } });
  } catch (error) {
    return serverError(error);
  }
}

// Add more items to an existing running order
export async function PATCH(req: NextRequest) {
  const guard = await requireAuth(req, 'order.create');
  if (!guard.ok) return guard.response;
  return withIdempotency(req, guard.auth, () => addRound(req, guard.auth));
}

async function addRound(req: NextRequest, auth: AuthContext) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const orderId = str(body.orderId, 40);
    const order = mongoose.isValidObjectId(orderId)
      ? await OrderModel.findById(orderId)
      : await OrderModel.findOne({ orderNumber: orderId, closed: false });
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    if (order.closed) return NextResponse.json({ success: false, error: 'This bill is already closed' }, { status: 409 });

    const priced = await priceItems(body.newItems);
    if ('error' in priced) return NextResponse.json({ success: false, error: priced.error }, { status: priced.status });

    order.items.push(...priced.items);
    await order.save();
    const newKots = await createStationKots(order, priced.items, str(body.notes, 500), order.duration);
    await queueKots(newKots, auth);

    broadcastRealtimeEvent('ORDER_UPDATED', { order: order.toObject(), kots: newKots });
    for (const k of newKots) broadcastRealtimeEvent('KOT_CREATED', k);

    return NextResponse.json({ success: true, data: { order, newKots } });
  } catch (error) {
    return serverError(error);
  }
}
