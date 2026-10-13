import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAuth, str } from '@/lib/auth';
import { maxSuffix, nextSequence } from '@/lib/counters';

const VENUES = ['VIP Lounge', 'Couple Cabin'];
import { connectToDatabase } from '@/lib/mongodb';
import { PrivateBookingModel } from '@/models/PrivateBooking';
import { broadcastRealtimeEvent } from '@/lib/realtime';


export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
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
  try {
    await connectToDatabase();
    const body = await req.json();
    const { venue, guest, phone, rate, advance, hours, notes } = body;
    if (!VENUES.includes(venue) || !str(guest, 80) || !str(phone, 20) || !(Number(rate) >= 0) || !(Number(hours) > 0)) {
      return NextResponse.json({ success: false, error: 'Enter venue, guest, phone, rate and hours' }, { status: 400 });
    }
    // A private space can only hold one active booking
    if (await PrivateBookingModel.exists({ venue, status: 'ACTIVE' })) {
      return NextResponse.json({ success: false, error: `${venue} already has an active booking` }, { status: 409 });
    }

    const seq = await nextSequence('booking', async () => {
      const all = await PrivateBookingModel.find({ bookingNumber: /^BK-/ }).select('bookingNumber').lean();
      return maxSuffix(all.map((b) => b.bookingNumber), 'BK-', 100);
    });
    const bookingNumber = `BK-${seq}`;

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
  try {
    await connectToDatabase();
    const body = await req.json();
    const ref = str(body.bookingId, 40);
    if (body.status !== undefined && body.status !== 'CLOSED') {
      return NextResponse.json({ success: false, error: 'Bookings can only be closed' }, { status: 400 });
    }
    // The web sends the booking number ("BK-101"); other clients may send the id
    const updated = await PrivateBookingModel.findOneAndUpdate(
      mongoose.isValidObjectId(ref) ? { _id: ref } : { bookingNumber: ref },
      { $set: { status: 'CLOSED', end: new Date() } },
      { returnDocument: 'after' }
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
