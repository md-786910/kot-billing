import { NextRequest, NextResponse } from 'next/server';
import { audit, AuthContext, authorizeOrApprove, requireAuth, serverError } from '@/lib/auth';
import { withIdempotency } from '@/lib/idempotency';
import { CASHIER_DISCOUNT_LIMIT_PERCENT } from '@/lib/auth/permissions';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { OrderModel } from '@/models/Order';
import { TableModel } from '@/models/Table';
import { ShiftRegisterModel } from '@/models/ShiftRegister';
import { PrivateBookingModel } from '@/models/PrivateBooking';
import { SettingsModel } from '@/models/Settings';
import { broadcastRealtimeEvent } from '@/lib/realtime';

// A retried settlement with the same idempotencyKey returns the first result instead of paying twice
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, 'bill.settle');
  if (!guard.ok) return guard.response;
  return withIdempotency(req, guard.auth, () => settleBill(req, guard.auth));
}

async function settleBill(req: NextRequest, auth: AuthContext) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const {
      orderId,
      payment, // single payment { amount, method, creditRef }
      payments, // multiple split payments [{ amount, method, creditRef }]
      discount = 0,
      discountType = 'flat',
      discountPercent = 0,
      discountReason = '',
      taxPercent = 5,
      closeOrder = true,
    } = body;

    let order = null;
    if (mongoose.isValidObjectId(orderId)) {
      order = await OrderModel.findById(orderId);
    }
    if (!order) {
      order = await OrderModel.findOne({ orderNumber: orderId });
    }
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    if (order.closed) {
      return NextResponse.json({ success: false, error: 'This bill is already settled' }, { status: 409 });
    }

    // Discounts above the cashier limit need a manager (or a manager's PIN)
    const subtotal = order.items.filter((it) => !it.isVoided).reduce((sum, it) => sum + it.price * it.qty, 0);
    const discountValue = Math.max(0, Number(discount) || 0);
    if (discountValue > subtotal) {
      return NextResponse.json({ success: false, error: 'Discount cannot exceed the bill' }, { status: 400 });
    }
    let approvedBy = '';
    if (discountValue > (subtotal * CASHIER_DISCOUNT_LIMIT_PERCENT) / 100) {
      const approval = await authorizeOrApprove(req, auth, 'bill.discount.unlimited', body.approvalPin);
      if (!approval.ok) return approval.response;
      approvedBy = approval.approvedBy;
    }

    // GST is either the configured rate or off (exempt bill); never an arbitrary client value
    const settings = await SettingsModel.findOne().select('taxPercent').lean();
    const configuredTax = settings?.taxPercent ?? 5;
    const tax = Number(taxPercent);
    if (tax !== 0 && tax !== configuredTax) {
      return NextResponse.json({ success: false, error: `GST must be ${configuredTax}% or 0%` }, { status: 400 });
    }

    const tenders = (Array.isArray(payments) && payments.length > 0 ? payments : payment ? [payment] : [])
      .filter((p) => Number(p?.amount) > 0);
    for (const p of tenders) {
      if (!PAYMENT_METHODS.includes(p.method ?? 'Cash') || !Number.isFinite(Number(p.amount)) || Number(p.amount) > 1_000_000) {
        return NextResponse.json({ success: false, error: 'Invalid payment' }, { status: 400 });
      }
    }

    order.discountAmount = discountValue;
    if (discountType !== undefined) order.discountType = discountType === 'percentage' ? 'percentage' : 'flat';
    if (discountPercent !== undefined) order.discountPercent = Number(discountPercent) || 0;
    if (discountReason !== undefined) order.discountReason = String(discountReason).slice(0, 200);
    order.taxPercent = tax;
    for (const p of tenders) {
      order.payments.push({
        amount: Number(p.amount),
        method: p.method ?? 'Cash',
        creditRef: typeof p.creditRef === 'string' ? p.creditRef.slice(0, 100) : '',
        timestamp: new Date(),
      });
    }

    // The server decides whether the bill is paid: items (excl. voids) − discount + GST, less advances
    const booking = order.bookingId ? await findBooking(order.bookingId) : null;
    const afterDiscount = Math.max(0, subtotal - discountValue);
    const grandTotal = Math.round(afterDiscount + (afterDiscount * tax) / 100);
    const advances = (order.shishaAdvance || 0) + (booking?.advance || 0);
    const paid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = Math.max(0, grandTotal - advances - paid);
    const fullyPaid = balanceDue < 0.5;

    // Attach current active shift if any
    const activeShift = await ShiftRegisterModel.findOne({ status: 'OPEN' }).select('_id').lean();
    if (activeShift) {
      order.shiftId = activeShift._id.toString();
    }

    if (closeOrder && fullyPaid) {
      order.status = 'SETTLED';
      order.closed = true;
      order.closedAt = new Date();

      // Free the table
      await TableModel.updateOne(
        { name: order.tableName },
        { status: 'VACANT', currentOrderId: null }
      );
      broadcastRealtimeEvent('TABLE_STATUS_CHANGED', { name: order.tableName, status: 'VACANT' });

      // Auto-release private booking if linked
      if (booking && booking.status === 'ACTIVE') {
        const closedBooking = await PrivateBookingModel.findByIdAndUpdate(
          booking._id,
          { $set: { status: 'CLOSED', end: new Date() } },
          { returnDocument: 'after' }
        ).lean();
        if (closedBooking) {
          broadcastRealtimeEvent('BOOKING_CLOSED', closedBooking);
        }
      }
    }

    await order.save();
    await audit(auth, order.closed ? 'bill.settled' : 'bill.payment', order.orderNumber, {
      discount: discountValue,
      discountReason,
      payments: order.payments.length,
    }, approvedBy);

    broadcastRealtimeEvent('BILL_SETTLED', order.toObject());

    return NextResponse.json({ success: true, data: order, grandTotal, balanceDue });
  } catch (error) {
    return serverError(error);
  }
}

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Credit Account'];

/** Bookings are referenced by id or by booking number (e.g. "BK-101"). */
async function findBooking(ref: string) {
  return mongoose.isValidObjectId(ref)
    ? PrivateBookingModel.findById(ref).lean()
    : PrivateBookingModel.findOne({ bookingNumber: ref }).lean();
}
