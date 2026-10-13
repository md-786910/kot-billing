"use client";
import React, { useState } from 'react';
import { Order, PrivateBooking } from '../types/pos';
import { formatINR, formatDateTime, getElapsedMinutes } from '../utils/format';
import { Receipt, Clock, PlusCircle, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface LiveOrdersViewProps {
  orders: Order[];
  bookings: PrivateBooking[];
  onOpenBilling: (orderId: string) => void;
  onAddMoreItems: (location: string) => void;
}

export const LiveOrdersView: React.FC<LiveOrdersViewProps> = ({
  orders,
  bookings,
  onOpenBilling,
  onAddMoreItems,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('open');

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'open') return !o.closed;
    if (filterStatus === 'closed') return o.closed;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-[#14161f] border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#d4af37]" />
            <span>Live Restaurant Orders</span>
          </h2>
          <p className="text-xs text-neutral-400">
            View active tables, running dockets, elapsed times, and quick billing shortcuts.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#1b1e2a] p-1 rounded-lg border border-neutral-800">
          <button
            onClick={() => setFilterStatus('open')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              filterStatus === 'open'
                ? 'bg-[#9f1119] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Active Open ({orders.filter((o) => !o.closed).length})
          </button>
          <button
            onClick={() => setFilterStatus('closed')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              filterStatus === 'closed'
                ? 'bg-[#9f1119] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Settled ({orders.filter((o) => o.closed).length})
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              filterStatus === 'all'
                ? 'bg-[#9f1119] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            All Orders ({orders.length})
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-[#14161f] border border-neutral-800 rounded-xl text-neutral-400 text-xs">
          No orders match the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const booking = bookings.find((b) => b.id === order.bookingId);
            const itemsSum = order.items.reduce((s, it) => s + it.price * it.qty, 0);
            const roomCharge = booking ? booking.rate * booking.hours : 0;
            const totalBill = itemsSum + roomCharge;
            const advances = (booking ? booking.advance : 0) + (order.shishaAdvance || 0);
            const paid = order.payments.reduce((s, p) => s + p.amount, 0) + advances;
            const bal = Math.max(0, totalBill - paid);
            const elapsed = getElapsedMinutes(order.created);

            return (
              <div
                key={order.id}
                className="bg-[#151722] border border-neutral-800 rounded-xl p-4 flex flex-col justify-between shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">{order.location}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/40 text-[#d4af37] border border-[#d4af37]/30">
                          {order.id}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 mt-1">
                        Guest: <span className="text-neutral-200">{order.guest || 'Walk-in'}</span> · Server: {order.staff}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        order.closed
                          ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {order.closed ? 'CLOSED' : 'OPEN'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-400 my-2 pt-2 border-t border-white/5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      {formatDateTime(order.created).split(',')[0]}
                    </span>
                    <span className="font-mono">{elapsed} mins elapsed</span>
                  </div>

                  {/* Summary of items */}
                  <div className="my-3 p-3 bg-black/30 rounded-lg space-y-1 text-xs border border-white/5 max-h-[140px] overflow-y-auto">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-neutral-300">
                          {it.qty}x {it.name}
                        </span>
                        <span className="text-neutral-400 font-mono">
                          {formatINR(it.price * it.qty)}
                        </span>
                      </div>
                    ))}
                    {roomCharge > 0 && (
                      <div className="flex justify-between text-amber-300 font-semibold pt-1 border-t border-white/5">
                        <span>Room Charge ({booking?.venue})</span>
                        <span className="font-mono">{formatINR(roomCharge)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-800 mb-3">
                    <span className="text-neutral-400">Total Bill:</span>
                    <span className="text-base font-bold text-[#d4af37] font-mono">
                      {formatINR(totalBill)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!order.closed && (
                      <button
                        onClick={() => onAddMoreItems(order.location)}
                        className="py-2 px-3 bg-[#1e2230] hover:bg-[#282d40] text-neutral-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        title="Add items to this table docket"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>Add Items</span>
                      </button>
                    )}

                    <button
                      onClick={() => onOpenBilling(order.id)}
                      className="flex-1 py-2 px-3 bg-[#9f1119] hover:bg-[#b91c1c] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>{order.closed ? 'View Receipt' : 'Open Bill'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
