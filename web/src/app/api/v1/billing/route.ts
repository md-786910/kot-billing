import { NextRequest, NextResponse } from 'next/server';
import { audit, AuthContext, authorizeOrApprove, requireAuth } from '@/lib/auth';
import { withIdempotency } from '@/lib/idempotency';
import { CASHIER_DISCOUNT_LIMIT_PERCENT } from '@/lib/auth/permissions';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { OrderModel } from '@/models/Order';
import { TableModel } from '@/models/Table';
import { ShiftRegisterModel } from '@/models/ShiftRegister';
import { PrivateBookingModel } from '@/models/PrivateBooking';
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

    if (discount !== undefined) order.discountAmount = discountValue;
    if (discountType !== undefined) order.discountType = discountType;
    if (discountPercent !== undefined) order.discountPercent = Number(discountPercent);
    if (discountReason !== undefined) order.discountReason = discountReason;
    if (taxPercent !== undefined) order.taxPercent = Number(taxPercent);

    // Support single payment or multiple split tender payments
    if (Array.isArray(payments) && payments.length > 0) {
      payments.forEach((p) => {
        if (Number(p.amount) > 0) {
          order.payments.push({
            amount: Number(p.amount),
            method: p.method || 'Cash',
            creditRef: p.creditRef || '',
            timestamp: new Date(),
          });
        }
      });
    } else if (payment && Number(payment.amount) > 0) {
      order.payments.push({
        amount: Number(payment.amount),
        method: payment.method || 'Cash',
        creditRef: payment.creditRef || '',
        timestamp: new Date(),
      });
    }

    // Attach current active shift if any
    const activeShift = await ShiftRegisterModel.findOne({ status: 'OPEN' }).select('_id').lean();
    if (activeShift) {
      order.shiftId = activeShift._id.toString();
    }

    if (closeOrder) {
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
      if (order.bookingId) {
        const closedBooking = await PrivateBookingModel.findByIdAndUpdate(
          order.bookingId,
          { $set: { status: 'CLOSED', end: new Date() } },
          { new: true }
        ).lean();
        if (closedBooking) {
          broadcastRealtimeEvent('BOOKING_CLOSED', closedBooking);
        }
      }
    }

    await order.save();
    await audit(auth, closeOrder ? 'bill.settled' : 'bill.payment', order.orderNumber, {
      discount: discountValue,
      discountReason,
      payments: order.payments.length,
    }, approvedBy);

    broadcastRealtimeEvent('BILL_SETTLED', order.toObject());

    return NextResponse.json({ success: true, data: order });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
