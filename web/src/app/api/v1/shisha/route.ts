import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { KOTModel } from '@/models/KOT';
import { OrderModel } from '@/models/Order';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function GET() {
  try {
    await connectToDatabase();
    const shishaKots = await KOTModel.find({ station: 'Shisha Master' })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: shishaKots });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { kotId, action, flavorName, addMinutes, addCharge = 0, charge = 0, markServed } = body;

    let kot = null;
    if (mongoose.isValidObjectId(kotId)) {
      kot = await KOTModel.findById(kotId);
    }
    if (!kot) {
      kot = await KOTModel.findOne({ kotNumber: kotId });
    }
    if (!kot) {
      return NextResponse.json({ success: false, error: 'KOT not found' }, { status: 404 });
    }

    // Helper to find parent order
    const findOrder = async () => {
      if (!kot.orderId) return null;
      if (mongoose.isValidObjectId(kot.orderId)) {
        return await OrderModel.findById(kot.orderId);
      }
      return await OrderModel.findOne({ orderNumber: kot.orderId });
    };

    // Action 1: Shisha Flavour Head Change (fresh chillum bowl)
    if (action === 'head_change') {
      const headCharge = Number(charge || addCharge || 199);
      kot.duration = 45;
      kot.startedAt = new Date();
      kot.notes = (kot.notes ? kot.notes + ' | ' : '') + `Head Changed: ${flavorName || 'Fresh Bowl'}`;

      const order = await findOrder();
      if (order && headCharge > 0) {
        order.items.push({
          name: `Shisha Head Change (${flavorName || 'Fresh Flavour'})`,
          price: headCharge,
          station: 'Shisha Master',
          category: 'Shisha Extras',
          qty: 1,
          notes: `Fresh tobacco chillum: ${flavorName || 'Selected Flavour'}`,
        });
        await order.save();
        broadcastRealtimeEvent('ORDER_UPDATED', { order: order.toObject() });
      }
    }
    // Action 2: Charcoal Refill
    else if (action === 'coal_refill') {
      const coalCharge = Number(charge || addCharge || 0);
      kot.duration = (kot.duration || 45) + 15;
      kot.notes = (kot.notes ? kot.notes + ' | ' : '') + 'Charcoal Refilled';

      const order = await findOrder();
      if (order && coalCharge > 0) {
        order.items.push({
          name: 'Fresh Coconut Charcoal Refill',
          price: coalCharge,
          station: 'Shisha Master',
          category: 'Shisha Extras',
          qty: 1,
          notes: 'Extra hot coconut charcoals',
        });
        await order.save();
        broadcastRealtimeEvent('ORDER_UPDATED', { order: order.toObject() });
      }
    }
    // Standard Timer Extension
    else if (addMinutes) {
      kot.duration = (kot.duration || 45) + Number(addMinutes);

      // If there's an extension fee or coal charge, add it to the running order
      if (Number(addCharge) > 0 && kot.orderId) {
        const order = await findOrder();
        if (order) {
          order.items.push({
            name: `Shisha Pot Extension (+${addMinutes}m / Coal)`,
            price: Number(addCharge),
            station: 'Shisha Master',
            category: 'Shisha Extras',
            qty: 1,
            notes: `Extending session by ${addMinutes} mins`,
          });
          await order.save();
          broadcastRealtimeEvent('ORDER_UPDATED', { order: order.toObject() });
        }
      }
    }

    if (markServed) {
      kot.status = 'SERVED';
      kot.servedAt = new Date();
    }

    await kot.save();

    broadcastRealtimeEvent('SHISHA_TIMER_UPDATED', kot.toObject());

    return NextResponse.json({ success: true, data: kot });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
