import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { PrivateBookingModel } from '@/models/PrivateBooking';
import { broadcastRealtimeEvent } from '@/lib/realtime';


export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
  const { auth } = guard;
  try {
    await connectToDatabase();
    const bookings = await PrivateBookingModel.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: bookings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, 'booking.manage');
  if (!guard.ok) return guard.response;
  const { auth } = guard;
  try {
    await connectToDatabase();
    const body = await req.json();
    const { venue, guest, phone, rate, advance, hours, notes } = body;

    // Generate Booking sequence BK-XXX
    const lastBooking = await PrivateBookingModel.findOne().sort({ createdAt: -1 }).select('bookingNumber').lean();
    let nextNum = 101;
    if (lastBooking && lastBooking.bookingNumber) {
      const match = lastBooking.bookingNumber.match(/\d+/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    const bookingNumber = `BK-${nextNum}`;

    const newBooking = await PrivateBookingModel.create({
      bookingNumber,
      venue,
      guest,
      phone,
      rate: Number(rate),
      advance: Number(advance || 0),
      hours: Number(hours),
      notes: notes || '',
      status: 'ACTIVE',
      start: new Date(),
    });

    broadcastRealtimeEvent('BOOKING_CREATED', newBooking.toObject());

    return NextResponse.json({ success: true, data: newBooking });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAuth(req, 'booking.manage');
  if (!guard.ok) return guard.response;
  const { auth } = guard;
  try {
    await connectToDatabase();
    const body = await req.json();
    const { bookingId, status = 'CLOSED' } = body;

    const updated = await PrivateBookingModel.findByIdAndUpdate(
      bookingId,
      { $set: { status, end: new Date() } },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    broadcastRealtimeEvent('BOOKING_CLOSED', updated);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
