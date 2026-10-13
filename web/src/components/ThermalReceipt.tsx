"use client";
import React from 'react';
import { KOT, Order, PrivateBooking, AppSettings } from '../types/pos';
import { formatINR, formatDateTime } from '../utils/format';
import { Printer, X } from 'lucide-react';

interface ThermalReceiptProps {
  type: 'kot' | 'bill';
  kot?: KOT;
  order?: Order;
  booking?: PrivateBooking;
  settings: AppSettings;
  onClose?: () => void;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  type,
  kot,
  order,
  booking,
  settings,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  // Calculations for billing receipt (voided items excluded from charges)
  const itemTotal = order
    ? order.items.filter((it) => !it.isVoided).reduce((s, it) => s + it.price * it.qty, 0)
    : 0;
  const roomHours = booking ? booking.hours : 0;
  const roomRate = booking ? booking.rate : 0;
  const roomCharge = roomHours * roomRate;
  const subtotal = itemTotal + roomCharge;
  const discount = order ? order.discountAmount || 0 : 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const taxPercent = order ? (order.taxPercent ?? settings.taxPercent) : settings.taxPercent;
  const taxAmount = (afterDiscount * taxPercent) / 100;
  const grandTotal = afterDiscount + taxAmount;
  const advances = (booking ? booking.advance : 0) + (order ? order.shishaAdvance || 0 : 0);
  const paid = (order ? order.payments.reduce((s, p) => s + p.amount, 0) : 0) + advances;
  const balanceDue = grandTotal - paid;

  return (
    <div>
      {/* On-screen modal controls when viewed interactively */}
      {onClose && (
        <div className="no-print flex items-center justify-between p-3 bg-neutral-900 border-b border-neutral-800 text-neutral-200">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-[#d4af37]" />
            <span className="text-sm font-semibold">
              {type === 'kot' ? `Station KOT · ${kot?.station}` : `Thermal Bill · ${order?.id}`}
            </span>
            <span className="text-xs text-neutral-400">80mm / 4-Inch Thermal Printout</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9f1119] hover:bg-[#b91c1c] text-white rounded text-xs font-semibold cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print to Printer</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Actual 80mm receipt container (both on-screen paper preview and print target) */}
      <div className="p-4 bg-white text-black font-mono text-[12px] leading-snug max-w-[340px] mx-auto select-all shadow-lg rounded-sm print:shadow-none print:max-w-none print:p-0">
        {type === 'kot' && kot && (
          <div>
            <div className="text-center pb-2 border-b-2 border-black border-dashed">
              <div className="font-bold text-base tracking-widest">{settings.loungeName}</div>
              <div className="text-xs font-semibold">{settings.tagline}</div>
              <div className="mt-1 font-bold text-sm bg-black text-white py-0.5 px-2 inline-block rounded-xs">
                {kot.station.toUpperCase()} KOT
              </div>
            </div>

            <div className="py-2 border-b border-black border-dashed text-[11px] space-y-0.5">
              <div className="flex justify-between font-bold">
                <span>KOT #: {kot.id}</span>
                <span>{kot.location}</span>
              </div>
              <div className="flex justify-between">
                <span>Order: {kot.orderId}</span>
                <span>{formatDateTime(kot.created)}</span>
              </div>
              {kot.guest && (
                <div>Guest: <span className="font-bold">{kot.guest}</span></div>
              )}
              {kot.station === 'Shisha Master' && kot.duration && (
                <div className="font-bold bg-neutral-100 p-1 border border-black mt-1">
                  POT DURATION: {kot.duration} MINUTES
                </div>
              )}
            </div>

            <div className="py-2 border-b-2 border-black border-dashed">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-0.5 w-8">QTY</th>
                    <th className="py-0.5">ITEM</th>
                    <th className="py-0.5 text-right">AMT</th>
                  </tr>
                </thead>
                <tbody>
                  {kot.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-neutral-300">
                      <td className="py-1 font-bold align-top">{it.qty}x</td>
                      <td className="py-1 align-top">
                        <div className="font-semibold">{it.name}</div>
                        {it.notes && (
                          <div className="text-[10px] italic text-neutral-700">Note: {it.notes}</div>
                        )}
                      </td>
                      <td className="py-1 text-right align-top tabular-nums">
                        {formatINR(it.price * it.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {kot.notes && (
              <div className="py-2 border-b border-black border-dashed text-[11px]">
                <span className="font-bold">KITCHEN / FLAVOUR NOTES:</span>
                <div className="italic mt-0.5">{kot.notes}</div>
              </div>
            )}

            <div className="pt-2 text-center text-[10px]">
              <div>Prepared by: _____________________</div>
              <div className="font-bold mt-1 tracking-wider">*** PREPARATION DOCKET ***</div>
            </div>
          </div>
        )}

        {type === 'bill' && order && (
          <div>
            <div className="text-center pb-2 border-b-2 border-black border-dashed">
              <div className="font-bold text-base tracking-widest">{settings.loungeName}</div>
              <div className="text-[10px] uppercase">{settings.tagline}</div>
              <div className="text-[10px]">{settings.address}</div>
              <div className="text-[10px]">Ph: {settings.phone}</div>
              {settings.gstNumber && (
                <div className="text-[10px] font-bold">GSTIN: {settings.gstNumber}</div>
              )}
              <div className="mt-1 font-bold text-xs border border-black py-0.5 px-2 inline-block">
                TAX INVOICE / GUEST RECEIPT
              </div>
            </div>

            <div className="py-2 border-b border-black border-dashed text-[11px] space-y-0.5">
              <div className="flex justify-between font-bold">
                <span>INVOICE: {order.id}</span>
                <span>{order.location}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Date: {formatDateTime(order.created)}</span>
                <span>Server: {order.staff}</span>
              </div>
              {order.guest && (
                <div className="text-[10px]">
                  Guest: <span className="font-bold">{order.guest}</span>
                  {order.phone && <span> ({order.phone})</span>}
                </div>
              )}
              {booking && (
                <div className="text-[10px] bg-neutral-100 p-1 border border-neutral-300">
                  Private Space: {booking.venue} ({booking.id})
                  <br />
                  Est. Duration: {booking.hours} hr(s) @ {formatINR(booking.rate)}/hr
                </div>
              )}
            </div>

            <div className="py-2 border-b-2 border-black border-dashed">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-black text-[10px]">
                    <th className="py-0.5 w-6">QTY</th>
                    <th className="py-0.5">ITEM DESCRIPTION</th>
                    <th className="py-0.5 text-right w-12">RATE</th>
                    <th className="py-0.5 text-right w-14">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it, idx) => (
                    <tr key={idx} className={`border-b border-neutral-200 ${it.isVoided ? 'line-through text-neutral-400' : ''}`}>
                      <td className="py-1 font-bold align-top">{it.qty}</td>
                      <td className="py-1 align-top">
                        <div>{it.name}</div>
                        <span className="text-[9px] text-neutral-500 uppercase">{it.station}</span>
                        {it.isVoided && (
                          <div className="text-[9px] text-neutral-600 font-bold no-underline">
                            VOID: {it.voidReason || 'Manager Authorised'}
                          </div>
                        )}
                      </td>
                      <td className="py-1 text-right align-top tabular-nums text-[10px]">{formatINR(it.price)}</td>
                      <td className="py-1 text-right align-top tabular-nums font-semibold">
                        {it.isVoided ? '₹0.00' : formatINR(it.price * it.qty)}
                      </td>
                    </tr>
                  ))}
                  {roomCharge > 0 && (
                    <tr className="border-b border-neutral-200 bg-neutral-50">
                      <td className="py-1 font-bold">{roomHours}h</td>
                      <td className="py-1">Room Space Charge</td>
                      <td className="py-1 text-right tabular-nums text-[10px]">{formatINR(roomRate)}</td>
                      <td className="py-1 text-right tabular-nums font-semibold">{formatINR(roomCharge)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="py-2 border-b border-black border-dashed text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="tabular-nums">{formatINR(itemTotal)}</span>
              </div>
              {roomCharge > 0 && (
                <div className="flex justify-between">
                  <span>Room Charge ({roomHours} hrs):</span>
                  <span className="tabular-nums">{formatINR(roomCharge)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>Discount:</span>
                  <span className="tabular-nums">- {formatINR(discount)}</span>
                </div>
              )}
              {taxPercent > 0 && (
                <>
                  <div className="flex justify-between text-[10px] text-neutral-600">
                    <span>CGST ({taxPercent / 2}%):</span>
                    <span className="tabular-nums">{formatINR(taxAmount / 2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-600">
                    <span>SGST ({taxPercent / 2}%):</span>
                    <span className="tabular-nums">{formatINR(taxAmount / 2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                <span>GRAND TOTAL:</span>
                <span className="tabular-nums">{formatINR(grandTotal)}</span>
              </div>
            </div>

            <div className="py-2 border-b border-black border-dashed text-[11px] space-y-1">
              <div className="font-bold text-[10px] uppercase text-neutral-600">Payments & Advances:</div>
              {booking && booking.advance > 0 && (
                <div className="flex justify-between">
                  <span>Space Booking Advance:</span>
                  <span className="tabular-nums text-emerald-800 font-semibold">- {formatINR(booking.advance)}</span>
                </div>
              )}
              {order.shishaAdvance > 0 && (
                <div className="flex justify-between">
                  <span>Shisha Deposit / Advance:</span>
                  <span className="tabular-nums text-emerald-800 font-semibold">- {formatINR(order.shishaAdvance)}</span>
                </div>
              )}
              {order.payments.map((p, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{p.method} ({formatDateTime(p.timestamp).split(',')[0]}):</span>
                  <span className="tabular-nums font-semibold">{formatINR(p.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                <span>BALANCE DUE:</span>
                <span className="tabular-nums font-bold">
                  {balanceDue <= 0 ? 'PAID / SETTLED' : formatINR(balanceDue)}
                </span>
              </div>
            </div>

            <div className="pt-3 text-center text-[10px] space-y-1">
              <div className="font-bold">THANK YOU FOR VISITING LAYALI!</div>
              <div>Please visit us again soon · For reservations call {settings.phone}</div>
              <div className="text-[9px] text-neutral-500">System generated invoice · No signature required</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
