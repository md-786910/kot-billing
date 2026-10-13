import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ShiftRegisterModel } from '@/models/ShiftRegister';
import { OrderModel } from '@/models/Order';

export async function GET() {
  try {
    await connectToDatabase();
    // Find active open shift
    let currentShift: any = await ShiftRegisterModel.findOne({ status: 'OPEN' }).lean();

    if (currentShift) {
      // Calculate real-time totals from orders settled since shift opened
      const settledOrders = await OrderModel.find({
        closed: true,
        closedAt: { $gte: currentShift.openedAt },
      }).lean();

      let liveCash = 0;
      let liveUpi = 0;
      let liveCard = 0;
      let liveCredit = 0;
      let liveDiscount = 0;
      let liveTax = 0;
      let liveSales = 0;

      settledOrders.forEach((o: any) => {
        liveDiscount += o.discountAmount || 0;
        liveTax += (o.taxPercent * (o.items.reduce((s: number, it: any) => s + it.price * it.qty, 0) - o.discountAmount)) / 100;

        o.payments.forEach((p: any) => {
          if (p.method === 'Cash') liveCash += p.amount;
          else if (p.method === 'UPI') liveUpi += p.amount;
          else if (p.method === 'Card') liveCard += p.amount;
          else if (p.method === 'Credit Account') liveCredit += p.amount;
        });

        const orderItemTotal = o.items.filter((it: any) => !it.isVoided).reduce((s: number, it: any) => s + it.price * it.qty, 0);
        liveSales += orderItemTotal;
      });

      const totalDrops = (currentShift.cashDrops || []).reduce((s: number, d: any) => s + d.amount, 0);
      const liveExpectedCash = currentShift.openingFloat + liveCash - totalDrops;

      currentShift = {
        ...currentShift,
        totalSales: liveSales,
        totalCash: liveCash,
        totalUpi: liveUpi,
        totalCard: liveCard,
        totalCredit: liveCredit,
        totalDiscount: liveDiscount,
        totalTax: liveTax,
        expectedCash: liveExpectedCash,
        ordersCount: settledOrders.length,
      };
    }

    // Also get recent closed shifts for history
    const pastShifts = await ShiftRegisterModel.find({ status: 'CLOSED' })
      .sort({ closedAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({
      success: true,
      currentShift,
      pastShifts,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const action = body.action?.toLowerCase();

    if (action === 'open') {
      const { openedBy = 'Cashier 1', openingFloat = 2000, notes = '' } = body;

      const existingOpen = await ShiftRegisterModel.findOne({ status: 'OPEN' });
      if (existingOpen) {
        return NextResponse.json(
          { success: false, error: 'A shift is already open. Please close current shift first.' },
          { status: 400 }
        );
      }

      // Generate sequence SH-XXX
      const count = await ShiftRegisterModel.countDocuments();
      const shiftNumber = `SH-${String(count + 1).padStart(3, '0')}`;

      const newShift = await ShiftRegisterModel.create({
        shiftNumber,
        openedBy,
        openingFloat: Number(openingFloat),
        status: 'OPEN',
        openedAt: new Date(),
        notes,
      });

      return NextResponse.json({ success: true, data: newShift });
    }

    if (action === 'drop' || action === 'cash_drop') {
      const { amount, reason, staff = 'Cashier 1' } = body;
      const activeShift = await ShiftRegisterModel.findOne({ status: 'OPEN' });
      if (!activeShift) {
        return NextResponse.json({ success: false, error: 'No active shift found.' }, { status: 404 });
      }

      activeShift.cashDrops.push({
        amount: Number(amount),
        reason,
        staff,
        timestamp: new Date(),
      });
      await activeShift.save();

      return NextResponse.json({ success: true, data: activeShift });
    }

    if (action === 'close') {
      const { closingCashActual, actualCash: reqActualCash, closedBy = 'Manager', notes = '' } = body;
      const actualCash = Number(closingCashActual ?? reqActualCash ?? 0);
      const activeShift = await ShiftRegisterModel.findOne({ status: 'OPEN' });
      if (!activeShift) {
        return NextResponse.json({ success: false, error: 'No active shift found.' }, { status: 404 });
      }

      // Calculate totals from settled orders in shift
      const settledOrders = await OrderModel.find({
        closed: true,
        closedAt: { $gte: activeShift.openedAt },
      }).lean();

      let totalCash = 0;
      let totalUpi = 0;
      let totalCard = 0;
      let totalCredit = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      let totalSales = 0;

      settledOrders.forEach((o) => {
        totalDiscount += o.discountAmount || 0;
        totalTax += (o.taxPercent * (o.items.reduce((s, it) => s + it.price * it.qty, 0) - o.discountAmount)) / 100;

        o.payments.forEach((p) => {
          if (p.method === 'Cash') totalCash += p.amount;
          else if (p.method === 'UPI') totalUpi += p.amount;
          else if (p.method === 'Card') totalCard += p.amount;
          else if (p.method === 'Credit Account') totalCredit += p.amount;
        });

        const orderItemTotal = o.items.filter((it) => !it.isVoided).reduce((s, it) => s + it.price * it.qty, 0);
        totalSales += orderItemTotal;
      });

      const totalDrops = activeShift.cashDrops.reduce((s, d) => s + d.amount, 0);
      const expectedCash = activeShift.openingFloat + totalCash - totalDrops;
      const cashDifference = actualCash - expectedCash; // Positive = Over, Negative = Short

      activeShift.status = 'CLOSED';
      activeShift.closedAt = new Date();
      activeShift.closedBy = closedBy;
      activeShift.closingCashActual = actualCash;
      activeShift.expectedCash = expectedCash;
      activeShift.cashDifference = cashDifference;
      activeShift.totalSales = totalSales;
      activeShift.totalCash = totalCash;
      activeShift.totalUpi = totalUpi;
      activeShift.totalCard = totalCard;
      activeShift.totalCredit = totalCredit;
      activeShift.totalDiscount = totalDiscount;
      activeShift.totalTax = totalTax;
      activeShift.ordersCount = settledOrders.length;
      if (notes) activeShift.notes = notes;

      await activeShift.save();

      return NextResponse.json({ success: true, data: activeShift });
    }

    return NextResponse.json({ success: false, error: 'Invalid shift action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
