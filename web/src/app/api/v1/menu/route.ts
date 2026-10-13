import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { audit, requireAuth, str } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { MenuItemModel } from '@/models/MenuItem';


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
    const { name, price, station, category, prepTimeMin } = body;

    const newItem = await MenuItemModel.create({
      name,
      price: Number(price),
      station,
      category,
      prepTimeMin: prepTimeMin ? Number(prepTimeMin) : 15,
      isAvailable: true,
    });

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
    if (price !== undefined) updateFields.price = Number(price);
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

    await audit(guard.auth, price !== undefined ? 'menu.price_changed' : 'menu.stock_changed', String(updated._id), {
      name: updated.name, ...updateFields,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
