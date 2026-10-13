import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/models/User';
import { getAuth, jsonError, serverError } from '@/lib/auth';

// Names for the PIN lock screen. Paired terminals/phones only; never exposes PINs or phone numbers.
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth.user && (!auth.device || auth.device.type === 'DISPLAY')) {
      return jsonError('This device is not paired', 401);
    }
    const users = await UserModel.find({ isActive: true, pinHash: { $exists: true } })
      .select('name role')
      .sort({ name: 1 })
      .lean();
    return NextResponse.json({
      success: true,
      data: users.map((u) => ({ id: String(u._id), name: u.name, role: u.role })),
    });
  } catch (error) {
    return serverError(error);
  }
}
