"use client";
import React, { useState, useMemo, useRef } from 'react';
import { Order, PrivateBooking, AppSettings, BillBooking } from '../types/pos';
import { formatINR, formatDateTime } from '../utils/format';
import {
  CreditCard,
  QrCode,
  Banknote,
  Receipt,
  Printer,
  CheckCircle2,
  Percent,
  ShieldCheck,
  User,
  Calculator,
  ArrowRight,
  Split,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  X,
  ExternalLink,
} from 'lucide-react';

interface SplitPaymentRow {
  method: 'Cash' | 'UPI' | 'Card' | 'Credit Account';
  amount: number;
  creditRef?: string;
}

interface BillingViewProps {
  orders: Order[];
  bookings: PrivateBooking[];
  settings: AppSettings;
  selectedOrderId: string;
  onSelectOrderId: (id: string) => void;
  onRecordPayment: (
    orderId: string,
    payment: {
      amount: number;
      method: 'Cash' | 'UPI' | 'Card' | 'Credit Account';
      creditRef?: string;
    },
    options?: {
      discount?: number;
      discountReason?: string;
      taxPercent?: number;
      payments?: Array<{
        amount: number;
        method: 'Cash' | 'UPI' | 'Card' | 'Credit Account';
        creditRef?: string;
      }>;
      /** Room charge for the printed receipt */
      booking?: BillBooking;
    }
  ) => Promise<boolean>;
  onPrintReceipt: (order: Order, booking?: PrivateBooking) => void;
}

const DISCOUNT_REASONS = [
  'VIP Courtesy / Management',
  'Owner / Director Discretion',
  'Happy Hour Promotion',
  'Delay in Service Compensation',
  'Staff Discretionary Roundoff',
  'Loyal Regular Guest Perk',
];

export const BillingView: React.FC<BillingViewProps> = ({
  orders,
  bookings,
  settings,
  selectedOrderId,
  onSelectOrderId,
  onRecordPayment,
  onPrintReceipt,
}) => {
  const currentOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];
  const linkedBooking = currentOrder
    ? bookings.find((b) => b.id === currentOrder.bookingId)
    : undefined;

  // Single vs Split Tender Mode
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);

  // Single Tender form state
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Credit Account'>('UPI');
  const [creditRef, setCreditRef] = useState<string>('');

  // Split Tender rows
  const [splitRows, setSplitRows] = useState<SplitPaymentRow[]>([
    { method: 'Cash', amount: 0 },
    { method: 'UPI', amount: 0 },
  ]);

  // Discount & Tax
  const [discountAmount, setDiscountAmount] = useState<number>(currentOrder?.discountAmount || 0);
  const [discountReason, setDiscountReason] = useState<string>(
    currentOrder?.discountReason || DISCOUNT_REASONS[0]
  );
  const [applyGst, setApplyGst] = useState<boolean>(true);
  const [settleToast, setSettleToast] = useState<string | null>(null);

  // UPI QR Preview Modal
  const [showUpiModal, setShowUpiModal] = useState<boolean>(false);

  // Billing Math (only non-voided items)
  const itemsTotal = useMemo(() => {
    if (!currentOrder) return 0;
    return currentOrder.items
      .filter((it) => !it.isVoided)
      .reduce((s, it) => s + it.price * it.qty, 0);
  }, [currentOrder]);

  // Billed hours with hourly space proration (defaults to max of booked hours or elapsed hours)
  const [billedHours, setBilledHours] = useState<number>(linkedBooking?.hours || 1);

  React.useEffect(() => {
    if (linkedBooking) {
      const elapsed = (Date.now() - new Date(linkedBooking.start).getTime()) / (1000 * 60 * 60);
      const prorated = Math.max(linkedBooking.hours, Math.ceil(elapsed * 2) / 2); // rounded up to nearest 0.5h
      setBilledHours(prorated);
    }
  }, [linkedBooking?.id]);

  const roomCharge = linkedBooking ? linkedBooking.rate * (billedHours || linkedBooking.hours) : 0;
  const subtotalBeforeDiscount = itemsTotal + roomCharge;
  const afterDiscount = Math.max(0, subtotalBeforeDiscount - (discountAmount || 0));
  const activeTaxPercent = applyGst ? settings.taxPercent : 0;
  const taxAmount = (afterDiscount * activeTaxPercent) / 100;
  const grandTotal = Math.round(afterDiscount + taxAmount);

  const bookingAdvance = linkedBooking ? linkedBooking.advance : 0;
  const shishaAdvance = currentOrder ? currentOrder.shishaAdvance || 0 : 0;
  const totalAdvances = bookingAdvance + shishaAdvance;

  const paymentsRecorded = currentOrder
    ? currentOrder.payments.reduce((s, p) => s + p.amount, 0)
    : 0;
  const totalCredited = totalAdvances + paymentsRecorded;
  const balanceDue = Math.max(0, grandTotal - totalCredited);

  // Split rows total
  const splitTotal = useMemo(() => {
    return splitRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [splitRows]);

  // Cash change calculation for single tender
  const effectiveEntered = paymentAmount === '' ? balanceDue : Number(paymentAmount) || 0;
  const enteredCashNote = cashTendered !== '' ? Number(cashTendered) || 0 : effectiveEntered;
  const changeToReturn = enteredCashNote > effectiveEntered ? enteredCashNote - effectiveEntered : 0;

  // UPI standard intent URI
  const upiId = settings.upiId || 'layali@okhdfcbank';
  const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(settings.loungeName)}&am=${balanceDue}&cu=INR`;

  // Room charge exactly as billed, for the printed receipt
  const printBooking: BillBooking | undefined = linkedBooking
    ? { venue: linkedBooking.venue, rate: linkedBooking.rate, hours: billedHours, advance: linkedBooking.advance }
    : undefined;

  // Confirmation toasts only appear once the server has accepted the settlement
  const settlingRef = useRef(false);
  const handleSettle = async () => {
    if (!currentOrder || settlingRef.current) return;
    settlingRef.current = true;
    try {
      await settle(currentOrder);
    } finally {
      settlingRef.current = false;
    }
  };

  const settle = async (currentOrder: Order) => {

    if (isSplitMode) {
      if (splitTotal <= 0) {
        alert('Please specify amounts for split tender.');
        return;
      }
      const validTenders = splitRows.filter((r) => Number(r.amount) > 0);
      const saved = await onRecordPayment(
        currentOrder.id,
        {
          amount: validTenders[0]?.amount || 0,
          method: validTenders[0]?.method || 'Cash',
          creditRef: validTenders[0]?.creditRef,
        },
        {
          discount: discountAmount,
          discountReason: discountAmount > 0 ? discountReason : undefined,
          taxPercent: activeTaxPercent,
          booking: printBooking,
          payments: validTenders,
        }
      );
      if (!saved) return;

      setSettleToast(
        `Split settlement of ${formatINR(splitTotal)} recorded for Table ${currentOrder.location}!`
      );
    } else {
      const amountToRecord = Math.min(effectiveEntered, balanceDue > 0 ? balanceDue : effectiveEntered);

      if (amountToRecord < 0) {
        alert('Payment amount cannot be negative.');
        return;
      }

      if (paymentMethod === 'Credit Account' && !creditRef.trim()) {
        alert('Please enter an authorized Credit Account reference.');
        return;
      }

      const saved = await onRecordPayment(
        currentOrder.id,
        {
          amount: amountToRecord,
          method: paymentMethod,
          creditRef: creditRef.trim() || undefined,
        },
        {
          discount: discountAmount,
          discountReason: discountAmount > 0 ? discountReason : undefined,
          taxPercent: activeTaxPercent,
          booking: printBooking,
        }
      );
      if (!saved) return;

      setPaymentAmount('');
      setCashTendered('');
      const newBal = balanceDue - amountToRecord;
      setSettleToast(
        newBal <= 0
          ? `Order #${currentOrder.orderNumber || currentOrder.id} (${currentOrder.location}) settled in full! Table marked closed.`
          : `Payment of ${formatINR(amountToRecord)} recorded. Remaining balance: ${formatINR(newBal)}`
      );
    }

    setTimeout(() => setSettleToast(null), 5000);
  };

  const quickDenominations = [500, 1000, 2000, 5000];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {settleToast && (
        <div className="p-4 bg-emerald-950/90 border border-emerald-500 text-emerald-100 rounded-xl flex items-center justify-between shadow-xl animate-fade-in backdrop-blur-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-bold text-sm tracking-wide">{settleToast}</span>
          </div>
          <button
            onClick={() => setSettleToast(null)}
            className="text-emerald-300 text-xs hover:underline cursor-pointer font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Select Order Bar */}
      <div className="bg-[#12141d] border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#d4af37]" />
            <span>Final Billing & Checkout Counter</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Generate 80mm thermal receipts, manage split tenders, cash return change, and audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-neutral-300 whitespace-nowrap">Choose Order:</label>
          <select
            value={currentOrder?.id || ''}
            onChange={(e) => onSelectOrderId(e.target.value)}
            className="px-3.5 py-2 bg-[#1a1d29] border border-neutral-700 text-white rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-[#d4af37]"
          >
            {orders.length === 0 && <option value="">No orders found</option>}
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber || o.id} · {o.location} ({o.guest || 'Walk-in'}) · {o.closed ? 'CLOSED' : 'OPEN'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!currentOrder ? (
        <div className="p-16 text-center bg-[#12141d] border border-neutral-800 rounded-2xl text-neutral-400 text-sm">
          No orders exist yet. Punch an order from the Seating Layout tab first.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Bill Breakdown (7 cols) */}
          <div className="lg:col-span-7 bg-[#12141d] border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xl">
            {/* Header info */}
            <div className="flex items-start justify-between pb-3 border-b border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold text-white">{currentOrder.location}</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-black/50 text-[#d4af37] border border-[#d4af37]/30">
                    {currentOrder.orderNumber || currentOrder.id}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      currentOrder.closed
                        ? 'bg-neutral-800 text-neutral-400'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    }`}
                  >
                    {currentOrder.closed ? 'Settled & Closed' : 'Open Balance'}
                  </span>
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  Server: <strong className="text-white">{currentOrder.staff}</strong> · Opened: {formatDateTime(currentOrder.created)}
                </div>
                {currentOrder.guest && (
                  <div className="text-xs text-neutral-300 mt-0.5">
                    Guest: <span className="font-bold text-white">{currentOrder.guest}</span>
                    {currentOrder.phone && <span> ({currentOrder.phone})</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPrintReceipt(currentOrder, linkedBooking ? { ...linkedBooking, hours: billedHours } : undefined)}
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-[#9f1119] hover:bg-[#b91c1c] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4 text-[#d4af37]" />
                  <span>Print Receipt</span>
                </button>
              </div>
            </div>

            {/* Linked Private Space Alert & Hourly Proration Controls */}
            {linkedBooking && (
              <div className="p-3 bg-[#1e1910] border border-amber-600/60 rounded-xl text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Private Space: {linkedBooking.venue} ({linkedBooking.id})</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-900/60 border border-amber-600/40 text-amber-200 font-bold uppercase">
                      Prorated
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-300 mt-1 flex flex-wrap items-center gap-2">
                    <span>Est: {linkedBooking.hours}h</span>
                    <span>·</span>
                    <span className="text-white font-semibold">
                      Elapsed: {((Date.now() - new Date(linkedBooking.start).getTime()) / (1000 * 60 * 60)).toFixed(1)}h
                    </span>
                    <span>·</span>
                    <span>Rate: {formatINR(linkedBooking.rate)}/hr</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-amber-600/40">
                    <span className="text-[11px] text-neutral-300 font-bold">Billed Space:</span>
                    <button
                      type="button"
                      onClick={() => setBilledHours((prev) => Math.max(0.5, prev - 0.5))}
                      className="w-5 h-5 bg-neutral-800 hover:bg-neutral-700 text-white rounded flex items-center justify-center font-bold text-xs cursor-pointer"
                      title="Decrease 30 mins"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-[#d4af37] text-xs px-1">
                      {billedHours}h
                    </span>
                    <button
                      type="button"
                      onClick={() => setBilledHours((prev) => prev + 0.5)}
                      className="w-5 h-5 bg-neutral-800 hover:bg-neutral-700 text-white rounded flex items-center justify-center font-bold text-xs cursor-pointer"
                      title="Increase 30 mins"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-mono font-extrabold text-base text-[#d4af37]">
                    {formatINR(roomCharge)}
                  </span>
                </div>
              </div>
            )}

            {/* Itemized Table */}
            <div className="border border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#171924] text-neutral-400 border-b border-neutral-800 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Item Description</th>
                    <th className="p-3 text-center">Station</th>
                    <th className="p-3 text-right">Rate</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 bg-[#141620]">
                  {currentOrder.items.map((it, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-white/5 transition-colors ${
                        it.isVoided ? 'bg-rose-950/20 text-neutral-500' : ''
                      }`}
                    >
                      <td className="p-3">
                        <div className={`font-semibold ${it.isVoided ? 'line-through text-rose-400' : 'text-white'}`}>
                          {it.name}
                        </div>
                        {it.isVoided && (
                          <div className="text-[10px] text-rose-300 font-bold">
                            VOIDED: {it.voidReason || 'Manager Authorised'}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center text-[10px] text-neutral-400 uppercase font-bold">
                        {it.station}
                      </td>
                      <td className="p-3 text-right tabular-nums text-neutral-300 font-mono">
                        {formatINR(it.price)}
                      </td>
                      <td className="p-3 text-center font-mono font-extrabold text-white">
                        {it.qty}
                      </td>
                      <td className="p-3 text-right tabular-nums font-bold text-white font-mono">
                        {it.isVoided ? (
                          <span className="text-neutral-500 line-through">₹0.00</span>
                        ) : (
                          formatINR(it.price * it.qty)
                        )}
                      </td>
                    </tr>
                  ))}
                  {roomCharge > 0 && (
                    <tr className="bg-amber-950/20">
                      <td className="p-3 font-bold text-amber-200">
                        Space Tariff ({linkedBooking?.venue})
                      </td>
                      <td className="p-3 text-center text-[10px] text-amber-300 uppercase font-bold">
                        Private Space
                      </td>
                      <td className="p-3 text-right tabular-nums text-amber-300 font-mono">
                        {formatINR(linkedBooking?.rate)}/hr
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-amber-200">
                        {billedHours}h
                      </td>
                      <td className="p-3 text-right tabular-nums font-extrabold text-[#d4af37] font-mono">
                        {formatINR(roomCharge)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations Summary Box */}
            <div className="bg-[#171924] rounded-xl p-4 space-y-2.5 text-xs border border-white/5">
              <div className="flex justify-between text-neutral-300">
                <span className="font-semibold">Items Subtotal:</span>
                <span className="tabular-nums font-mono font-bold">{formatINR(itemsTotal)}</span>
              </div>

              {roomCharge > 0 && (
                <div className="flex justify-between text-amber-300">
                  <span className="font-semibold">Room Space Tariff:</span>
                  <span className="tabular-nums font-mono font-bold">{formatINR(roomCharge)}</span>
                </div>
              )}

              {/* Discount Section with Reason */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="flex items-center gap-1 font-semibold">
                    <Percent className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Bill Discount (₹):</span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-28 px-2.5 py-1.5 bg-[#10121a] border border-neutral-700 rounded-lg text-right font-mono text-white text-xs font-bold focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                {discountAmount > 0 && (
                  <div className="flex items-center justify-between gap-2 text-[11px] animate-fade-in">
                    <span className="text-neutral-400 font-semibold whitespace-nowrap">
                      Discount Reason:
                    </span>
                    <select
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      className="w-full max-w-[260px] px-2.5 py-1 bg-[#10121a] border border-neutral-700 rounded-lg text-white font-medium text-[11px] focus:outline-none focus:border-[#d4af37]"
                    >
                      {DISCOUNT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* GST Toggle */}
              <div className="flex items-center justify-between text-neutral-300 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={applyGst}
                    onChange={(e) => setApplyGst(e.target.checked)}
                    className="rounded border-neutral-700 text-[#9f1119] focus:ring-0"
                  />
                  <span>Apply 5% Lounge GST:</span>
                </label>
                <span className="tabular-nums font-mono font-bold">
                  {applyGst ? formatINR(taxAmount) : '₹0.00 (Exempt)'}
                </span>
              </div>

              <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-neutral-800">
                <span>Grand Bill Total:</span>
                <span className="tabular-nums font-mono text-[#d4af37] text-lg">
                  {formatINR(grandTotal)}
                </span>
              </div>

              {/* Deductions: Advances & Payments */}
              <div className="pt-2 border-t border-neutral-800/80 space-y-1.5 text-xs text-emerald-400">
                {bookingAdvance > 0 && (
                  <div className="flex justify-between">
                    <span className="font-medium">Booking Advance Credited:</span>
                    <span className="tabular-nums font-mono font-bold">- {formatINR(bookingAdvance)}</span>
                  </div>
                )}
                {shishaAdvance > 0 && (
                  <div className="flex justify-between">
                    <span className="font-medium">Shisha Advance Credited:</span>
                    <span className="tabular-nums font-mono font-bold">- {formatINR(shishaAdvance)}</span>
                  </div>
                )}
                {paymentsRecorded > 0 && (
                  <div className="flex justify-between text-sky-400">
                    <span className="font-medium">Previous Payments Settled:</span>
                    <span className="tabular-nums font-mono font-bold">- {formatINR(paymentsRecorded)}</span>
                  </div>
                )}
              </div>

              {/* Net Balance Due Banner */}
              <div className="flex items-center justify-between text-lg font-extrabold pt-2.5 border-t border-neutral-700">
                <span className="text-white">Net Balance Due:</span>
                <span
                  className={`font-mono text-xl ${
                    balanceDue <= 0 ? 'text-emerald-400' : 'text-[#d4af37]'
                  }`}
                >
                  {balanceDue <= 0 ? 'PAID IN FULL (₹0.00)' : formatINR(balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Cashier Settlement Form (5 cols) */}
          <div className="lg:col-span-5 bg-[#12141d] border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xl sticky top-20">
            <div className="pb-3 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#d4af37]" />
                  <span>Settlement Tender</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Single or Split payment tenders with cash change logic.
                </p>
              </div>

              {/* Toggle Split Tender */}
              <button
                type="button"
                onClick={() => setIsSplitMode((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                  isSplitMode
                    ? 'bg-[#9f1119] border-[#d4af37] text-white shadow-md'
                    : 'bg-[#1a1d29] border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>{isSplitMode ? 'Split Mode ON' : 'Split Tender'}</span>
              </button>
            </div>

            {/* MULTI-TENDER SPLIT MODE */}
            {isSplitMode ? (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-semibold">Split Tender Breakdown:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSplitRows((prev) => [...prev, { method: 'Cash', amount: 0 }])
                    }
                    className="flex items-center gap-1 text-[#d4af37] hover:underline cursor-pointer font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Line</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {splitRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#171924] border border-neutral-800 rounded-xl flex items-center gap-2 text-xs"
                    >
                      <select
                        value={row.method}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setSplitRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, method: val } : r))
                          );
                        }}
                        className="px-2.5 py-1.5 bg-[#10121a] border border-neutral-700 rounded-lg text-white font-bold focus:outline-none focus:border-[#d4af37]"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Credit Account">Credit Acc</option>
                      </select>

                      <input
                        type="number"
                        min="0"
                        placeholder="Amount"
                        value={row.amount || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setSplitRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, amount: val } : r))
                          );
                        }}
                        className="flex-1 px-3 py-1.5 bg-[#10121a] border border-neutral-700 rounded-lg text-right font-mono font-bold text-white focus:outline-none focus:border-[#d4af37]"
                      />

                      {splitRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSplitRows((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-neutral-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-[#171924] border border-neutral-800 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Total Tendered:</span>
                  <span className="font-mono font-bold text-base text-white">
                    {formatINR(splitTotal)}
                  </span>
                </div>

                {splitTotal < balanceDue && (
                  <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Split total is short by {formatINR(balanceDue - splitTotal)}</span>
                  </div>
                )}
              </div>
            ) : (
              /* SINGLE TENDER MODE */
              <div className="space-y-4">
                {/* Quick Denomination Buttons */}
                {balanceDue > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                      Quick Amount Presets:
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentAmount(balanceDue.toFixed(2));
                          setCashTendered('');
                        }}
                        className="px-2.5 py-1 bg-[#1e2333] hover:bg-[#2c3349] text-white rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors"
                      >
                        Exact ({formatINR(balanceDue)})
                      </button>
                      {quickDenominations.map((denom) => (
                        <button
                          key={denom}
                          type="button"
                          onClick={() => {
                            setPaymentAmount(String(balanceDue));
                            setCashTendered(String(denom));
                          }}
                          className="px-2.5 py-1 bg-[#1a1d29] hover:bg-[#282d40] text-[#d4af37] border border-neutral-700 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors"
                        >
                          Tender ₹{denom}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment Amount Input */}
                <div>
                  <label className="text-xs font-bold text-neutral-200 block mb-1">
                    Amount to Settle (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder={balanceDue.toFixed(2)}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#1a1d29] border border-neutral-700 rounded-xl text-base text-[#d4af37] font-mono font-extrabold focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                {/* Cash Tendered & Change Return Calculator */}
                {paymentMethod === 'Cash' && (
                  <div className="p-3 bg-[#171924] border border-neutral-700/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-neutral-300">Cash Handed by Guest (₹):</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 2000"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="w-28 px-2.5 py-1 bg-[#10121a] border border-neutral-700 rounded-lg text-right font-mono text-white text-xs font-bold focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    {changeToReturn > 0 && (
                      <div className="p-2.5 bg-emerald-950 border border-emerald-500 rounded-lg flex items-center justify-between text-xs text-emerald-100 font-bold animate-fade-in">
                        <span>Change to Return:</span>
                        <span className="font-mono text-base text-emerald-300">
                          {formatINR(changeToReturn)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-2">
                    Payment Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Cash')}
                      className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        paymentMethod === 'Cash'
                          ? 'bg-[#9f1119] border-[#d4af37] text-white shadow-md'
                          : 'bg-[#1a1d29] border-neutral-800 text-neutral-300 hover:bg-[#252a3b]'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Cash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('UPI')}
                      className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        paymentMethod === 'UPI'
                          ? 'bg-[#9f1119] border-[#d4af37] text-white shadow-md'
                          : 'bg-[#1a1d29] border-neutral-800 text-neutral-300 hover:bg-[#252a3b]'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>UPI / QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Card')}
                      className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        paymentMethod === 'Card'
                          ? 'bg-[#9f1119] border-[#d4af37] text-white shadow-md'
                          : 'bg-[#1a1d29] border-neutral-800 text-neutral-300 hover:bg-[#252a3b]'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Card POS</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Credit Account')}
                      className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        paymentMethod === 'Credit Account'
                          ? 'bg-[#9f1119] border-[#d4af37] text-white shadow-md'
                          : 'bg-[#1a1d29] border-neutral-800 text-neutral-300 hover:bg-[#252a3b]'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span>Credit Acc</span>
                    </button>
                  </div>
                </div>

                {/* Show UPI Dynamic QR Preview Shortcut */}
                {paymentMethod === 'UPI' && (
                  <div className="p-3 bg-[#171924] border border-neutral-700/80 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 text-emerald-400" />
                        <span>UPI Payment QR Available</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        ID: {upiId} · Amount: {formatINR(balanceDue)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowUpiModal(true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1 text-xs"
                    >
                      <span>Show QR</span>
                    </button>
                  </div>
                )}

                {/* Credit Account Reference Field */}
                {paymentMethod === 'Credit Account' && (
                  <div className="p-3 bg-amber-950/30 border border-amber-700/80 rounded-xl space-y-1 text-xs">
                    <label className="block font-bold text-amber-200">
                      Approved Credit Account / Staff Code *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter authorized account or member code"
                      value={creditRef}
                      onChange={(e) => setCreditRef(e.target.value)}
                      className="w-full px-3 py-2 bg-[#10121a] border border-amber-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Settle Action Button */}
            <div className="pt-3 border-t border-neutral-800">
              <button
                onClick={handleSettle}
                disabled={currentOrder.closed && balanceDue <= 0}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xl transition-all ${
                  currentOrder.closed && balanceDue <= 0
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-[#9f1119] hover:bg-[#b91c1c] text-white shadow-[#9f1119]/30 active:scale-[0.99]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
                <span>
                  {currentOrder.closed && balanceDue <= 0
                    ? 'Order Already Settled & Closed'
                    : 'Confirm Settlement & Close Docket'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC UPI QR MODAL */}
      {showUpiModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#141622] border border-emerald-500/50 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                <span>UPI Fast Scan & Pay</span>
              </h3>
              <button
                onClick={() => setShowUpiModal(false)}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-xl shadow-inner inline-block mx-auto border-4 border-emerald-500/30">
              {/* QR Placeholder / SVG Rendering */}
              <div className="w-44 h-44 bg-neutral-900 rounded-lg flex flex-col items-center justify-center p-3 text-white text-center">
                <QrCode className="w-20 h-20 text-[#d4af37] mb-2" />
                <span className="text-[10px] text-neutral-300 font-mono break-all font-bold">
                  {upiId}
                </span>
                <span className="text-sm font-extrabold text-emerald-400 font-mono mt-1">
                  {formatINR(balanceDue)}
                </span>
              </div>
            </div>

            <div className="text-xs text-neutral-300 space-y-1">
              <div>Table: <strong className="text-white">{currentOrder?.location}</strong></div>
              <div>Accepts GPay, PhonePe, Paytm & all BHIM apps</div>
            </div>

            <button
              onClick={() => setShowUpiModal(false)}
              className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Close QR Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
