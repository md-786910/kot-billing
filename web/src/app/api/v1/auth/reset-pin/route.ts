import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { userId, staffName, currentPin, newPin } = body;

    if (!newPin || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        { success: false, error: 'New PIN must be exactly 4 digits' },
        { status: 400 }
      );
    }

    // Find user by userId or staffName
    let user = null;
    if (userId) {
      user = await UserModel.findById(userId);
    }
    if (!user && staffName) {
      user = await UserModel.findOne({ name: staffName, isActive: true });
    }
    if (!user && currentPin) {
      user = await UserModel.findOne({ pin: currentPin, isActive: true });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Staff user not found' },
        { status: 404 }
      );
    }

    // If currentPin is provided, verify it matches
    if (currentPin && user.pin !== currentPin) {
      return NextResponse.json(
        { success: false, error: 'Current PIN is incorrect' },
        { status: 401 }
      );
    }

    // Check if newPin is already taken by another active user
    const existing = await UserModel.findOne({ pin: newPin, _id: { $ne: user._id }, isActive: true });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `PIN ${newPin} is already assigned to ${existing.name}` },
        { status: 409 }
      );
    }

    // Update PIN
    user.pin = newPin;
    await user.save();

    return NextResponse.json({
      success: true,
      message: `PIN for ${user.name} successfully updated to ${newPin}`,
      data: {
        id: user._id,
        name: user.name,
        role: user.role,
        pin: user.pin,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
