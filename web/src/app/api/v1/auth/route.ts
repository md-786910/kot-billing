import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';


export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { pin } = await req.json();

    if (!pin) {
      return NextResponse.json({ success: false, error: 'PIN is required' }, { status: 400 });
    }

    const user = await UserModel.findOne({ pin, isActive: true }).lean();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid PIN' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
