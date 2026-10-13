import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { OrderModel } from '@/models/Order';
import { KOTModel } from '@/models/KOT';
import { TableModel } from '@/models/Table';
import { broadcastRealtimeEvent } from '@/lib/realtime';


async function getNextKotSequence(): Promise<number> {
  const kots = await KOTModel.find({ kotNumber: /^KOT-/ }).select('kotNumber').lean();
  let maxSeq = 0;
  for (const k of kots) {
    const match = k.kotNumber.match(/^KOT-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxSeq) maxSeq = num;
    }
  }
  return maxSeq + 1;
}

async function getNextOrderSequence(): Promise<number> {
  const orders = await OrderModel.find({ orderNumber: /^LY-/ }).select('orderNumber').lean();
  let maxSeq = 1000;
  for (const o of orders) {
    const match = o.orderNumber.match(/^LY-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxSeq) maxSeq = num;
    }
  }
  return maxSeq + 1;
}

export async function GET(req: NextRequest) {
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

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const {
      tableName,
      guestName = '',
      guestPhone = '',
      staffName = 'Captain 1',
      bookingId = null,
      items = [],
      notes = '',
      shishaAdvance = 0,
      duration = 45,
      taxPercent = 5,
    } = body;

    // Prevent duplicate collisions: if table already has an active open order, append items
    const existingOpenOrder = await OrderModel.findOne({ tableName, closed: false });
    if (existingOpenOrder) {
      existingOpenOrder.items.push(...items);
      if (guestName && !existingOpenOrder.guestName) existingOpenOrder.guestName = guestName;
      if (guestPhone && !existingOpenOrder.guestPhone) existingOpenOrder.guestPhone = guestPhone;
      if (bookingId && !existingOpenOrder.bookingId) existingOpenOrder.bookingId = bookingId;
      await existingOpenOrder.save();

      const stations = ['Kitchen', 'Beverage Counter', 'Shisha Master'] as const;
      const createdKots: any[] = [];
      let nextKotSeq = await getNextKotSequence();

      for (const station of stations) {
        const stationItems = items.filter((it: any) => it.station === station);
        if (stationItems.length > 0) {
          const kotNumber = `KOT-${String(nextKotSeq++).padStart(4, '0')}`;
          const newKot = await KOTModel.create({
            kotNumber,
            orderId: existingOpenOrder._id.toString(),
            orderNumber: existingOpenOrder.orderNumber,
            tableName,
            guestName: existingOpenOrder.guestName,
            station,
            items: stationItems.map((it: any) => ({
              name: it.name,
              price: it.price,
              qty: it.qty,
              notes: it.notes || '',
            })),
            notes,
            duration: station === 'Shisha Master' ? duration : undefined,
            status: 'NEW',
          });
          createdKots.push(newKot.toObject());
        }
      }

      broadcastRealtimeEvent('ORDER_UPDATED', { order: existingOpenOrder.toObject(), kots: createdKots });
      for (const k of createdKots) {
        broadcastRealtimeEvent('KOT_CREATED', k);
      }

      return NextResponse.json({
        success: true,
        data: {
          order: existingOpenOrder,
          kots: createdKots,
          appendedToExisting: true,
        },
      });
    }

    // Generate next Order Number: LY-XXXX
    const nextNum = await getNextOrderSequence();
    const orderNumber = `LY-${nextNum}`;

    // Create the Order document
    const newOrder = await OrderModel.create({
      orderNumber,
      tableName,
      guestName,
      guestPhone,
      staffName,
      bookingId,
      status: 'OPEN',
      items,
      notes,
      shishaAdvance: Number(shishaAdvance),
      duration: Number(duration),
      taxPercent: Number(taxPercent),
      discountAmount: 0,
      payments: [],
      closed: false,
    });

    // Update table occupancy
    await TableModel.updateOne(
      { name: tableName },
      { status: 'OCCUPIED', currentOrderId: newOrder._id.toString() }
    );

    // Group items by station and create KOTs
    const stations = ['Kitchen', 'Beverage Counter', 'Shisha Master'] as const;
    const createdKots: any[] = [];
    let nextKotSeq = await getNextKotSequence();

    for (const station of stations) {
      const stationItems = items.filter((it: any) => it.station === station);
      if (stationItems.length > 0) {
        const kotNumber = `KOT-${String(nextKotSeq++).padStart(4, '0')}`;
        const newKot = await KOTModel.create({
          kotNumber,
          orderId: newOrder._id.toString(),
          orderNumber: newOrder.orderNumber,
          tableName,
          guestName,
          station,
          items: stationItems.map((it: any) => ({
            name: it.name,
            price: it.price,
            qty: it.qty,
            notes: it.notes || '',
          })),
          notes,
          duration: station === 'Shisha Master' ? duration : undefined,
          status: 'NEW',
        });
        createdKots.push(newKot.toObject());
      }
    }

    // Broadcast realtime notifications
    broadcastRealtimeEvent('ORDER_CREATED', { order: newOrder.toObject(), kots: createdKots });
    broadcastRealtimeEvent('TABLE_STATUS_CHANGED', { name: tableName, status: 'OCCUPIED' });
    for (const k of createdKots) {
      broadcastRealtimeEvent('KOT_CREATED', k);
    }

    return NextResponse.json({
      success: true,
      data: {
        order: newOrder,
        kots: createdKots,
      },
    });
  } catch (error: any) {
    console.error('Order creation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Add more items to an existing running order
export async function PATCH(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { orderId, newItems = [], notes = '' } = body;

    let existingOrder = null;
    if (mongoose.isValidObjectId(orderId)) {
      existingOrder = await OrderModel.findById(orderId);
    }
    if (!existingOrder) {
      existingOrder = await OrderModel.findOne({ orderNumber: orderId, closed: false });
    }
    if (!existingOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Append items to order
    existingOrder.items.push(...newItems);
    await existingOrder.save();

    // Generate incremental KOT for only the new items
    const stations = ['Kitchen', 'Beverage Counter', 'Shisha Master'] as const;
    const createdKots: any[] = [];
    let nextKotSeq = await getNextKotSequence();

    for (const station of stations) {
      const stationItems = newItems.filter((it: any) => it.station === station);
      if (stationItems.length > 0) {
        const kotNumber = `KOT-${String(nextKotSeq++).padStart(4, '0')}`;
        const newKot = await KOTModel.create({
          kotNumber,
          orderId: existingOrder._id.toString(),
          orderNumber: existingOrder.orderNumber,
          tableName: existingOrder.tableName,
          guestName: existingOrder.guestName,
          station,
          items: stationItems.map((it: any) => ({
            name: it.name,
            price: it.price,
            qty: it.qty,
            notes: it.notes || '',
          })),
          notes,
          status: 'NEW',
        });
        createdKots.push(newKot.toObject());
      }
    }

    broadcastRealtimeEvent('ORDER_UPDATED', { order: existingOrder.toObject(), kots: createdKots });
    for (const k of createdKots) {
      broadcastRealtimeEvent('KOT_CREATED', k);
    }

    return NextResponse.json({
      success: true,
      data: { order: existingOrder, newKots: createdKots },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
