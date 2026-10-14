import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { audit, requireAuth, str } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { connectToDatabase } from '@/lib/mongodb';
import { MenuItemModel } from '@/models/MenuItem';

const STATIONS = ['Kitchen', 'Beverage Counter', 'Shisha Master'];


export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const station = searchParams.get('station');
    const category = searchParams.get('category');

    const filter: any = {};
    if (station && station !== 'All') filter.station = station;
    if (category && category !== 'All') filter.category = category;

    const items = await MenuItemModel.find(filter)
      .sort({ category: 1, name: 1 })
      .lean();

    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, 'menu.edit');
  if (!guard.ok) return guard.response;
  try {
    await connectToDatabase();
    const body = await req.json();
    const name = str(body.name, 80);
    const category = str(body.category, 40);
    const price = Number(body.price);
    if (!name) return NextResponse.json({ success: false, error: 'Enter the item name' }, { status: 400 });
    if (!Number.isFinite(price) || price < 0 || price > 100000) {
      return NextResponse.json({ success: false, error: 'Enter a price between ₹0 and ₹1,00,000' }, { status: 400 });
    }
    if (!STATIONS.includes(body.station)) return NextResponse.json({ success: false, error: 'Choose Kitchen, Bar or Shisha' }, { status: 400 });
    if (!category) return NextResponse.json({ success: false, error: 'Enter a category' }, { status: 400 });
    // Orders look items up by name, so names must be unique (case-insensitive)
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (await MenuItemModel.exists({ name: new RegExp(`^${escaped}$`, 'i') })) {
      return NextResponse.json({ success: false, error: `${name} is already on the menu` }, { status: 409 });
    }

    const newItem = await MenuItemModel.create({
      name,
      price: Math.round(price * 100) / 100,
      station: body.station,
      category,
      prepTimeMin: Number(body.prepTimeMin) > 0 ? Math.min(Number(body.prepTimeMin), 240) : 15,
      isAvailable: true,
    });
    await audit(guard.auth, 'menu.item_added', String(newItem._id), { name, price, station: body.station, category });
    broadcastRealtimeEvent('MENU_UPDATED');

    return NextResponse.json({ success: true, data: newItem });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, price, isAvailable } = body;

    // Out-of-stock toggle is allowed for managers; price changes are admin-only
    const guard = await requireAuth(req, price !== undefined ? 'menu.edit' : 'menu.stock');
    if (!guard.ok) return guard.response;

    const updateFields: any = {};
    if (price !== undefined) {
      const value = Number(price);
      if (!Number.isFinite(value) || value < 0 || value > 100000) {
        return NextResponse.json({ success: false, error: 'Enter a price between ₹0 and ₹1,00,000' }, { status: 400 });
      }
      updateFields.price = Math.round(value * 100) / 100;
    }
    if (isAvailable !== undefined) updateFields.isAvailable = Boolean(isAvailable);

    const key = str(id, 120);
    let updated = null;
    if (mongoose.isValidObjectId(key)) {
      updated = await MenuItemModel.findByIdAndUpdate(key, { $set: updateFields }, { new: true }).lean();
    }
    if (!updated) {
      updated = await MenuItemModel.findOneAndUpdate({ name: key }, { $set: updateFields }, { new: true }).lean();
    }
    if (!updated) return NextResponse.json({ success: false, error: 'Menu item not found' }, { status: 404 });

    broadcastRealtimeEvent('MENU_UPDATED');
    await audit(guard.auth, price !== undefined ? 'menu.price_changed' : 'menu.stock_changed', String(updated._id), {
      name: updated.name, ...updateFields,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
