import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { MenuItemModel } from '@/models/MenuItem';


export async function GET(req: NextRequest) {
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
    await connectToDatabase();
    const body = await req.json();
    const { id, price, isAvailable } = body;

    const updateFields: any = {};
    if (price !== undefined) updateFields.price = Number(price);
    if (isAvailable !== undefined) updateFields.isAvailable = Boolean(isAvailable);

    import('mongoose').then();
    let updated = null;
    const mongoose = await import('mongoose');
    if (mongoose.default.isValidObjectId(id)) {
      updated = await MenuItemModel.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
      ).lean();
    }
    if (!updated) {
      updated = await MenuItemModel.findOneAndUpdate(
        { name: id },
        { $set: updateFields },
        { new: true }
      ).lean();
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
