"use client";
import React, { useState } from 'react';
import { PrivateBooking } from '../types/pos';
import { formatINR, formatDateTime, getElapsedMinutes } from '../utils/format';
import { Shield, Clock, Calendar, Plus, User, Phone, CheckCircle, ArrowRight } from 'lucide-react';

interface PrivateBookingsViewProps {
  bookings: PrivateBooking[];
  onCreateBooking: (booking: Omit<PrivateBooking, 'id' | 'start' | 'status'>) => void;
  onCloseBooking: (bookingId: string) => void;
  onAttachOrder: (booking: PrivateBooking) => void;
}

export const PrivateBookingsView: React.FC<PrivateBookingsViewProps> = ({
  bookings,
  onCreateBooking,
  onCloseBooking,
  onAttachOrder,
}) => {
  const [venue, setVenue] = useState<'VIP Lounge' | 'Couple Cabin'>('VIP Lounge');
  const [guest, setGuest] = useState('');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState<number>(500);
  const [advance, setAdvance] = useState<number>(500);
  const [hours, setHours] = useState<number>(2);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guest.trim() || !phone.trim()) {
      alert('Please enter guest name and contact number.');
      return;
    }
    if (rate < 0 || advance < 0 || hours <= 0) {
      alert('Please enter valid rate, advance and duration estimates.');
      return;
    }

    onCreateBooking({
      venue,
      guest: guest.trim(),
      phone: phone.trim(),
      rate: Number(rate),
      advance: Number(advance),
      hours: Number(hours),
      notes: notes.trim(),
    });

    setGuest('');
    setPhone('');
    setNotes('');
  };

  const activeBookings = bookings.filter((b) => b.status === 'ACTIVE');
  const closedBookings = bookings.filter((b) => b.status === 'CLOSED');

  return (
    <div className="space-y-6">
      {/* Booking Entry Form */}
      <div className="bg-[#14161f] border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-[#d4af37]" />
          <div>
            <h2 className="text-base font-bold text-white">Create Private Space Booking</h2>
            <p className="text-xs text-neutral-400">
              Register VIP Lounge (2nd floor) or Couple Cabin (1st floor) with hourly billing & advance deposits.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Private Space Venue *
              </label>
              <select
                value={venue}
                onChange={(e) => setVenue(e.target.value as 'VIP Lounge' | 'Couple Cabin')}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
              >
                <option value="VIP Lounge">VIP Lounge (2nd Floor)</option>
                <option value="Couple Cabin">Couple Cabin (1st Floor)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Guest Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="Guest name"
                value={guest}
                onChange={(e) => setGuest(e.target.value)}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                placeholder="Mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Hourly Room Rate (₹) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-xs text-[#d4af37] font-mono font-bold focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Booking Advance Received (₹)
              </label>
              <input
                type="number"
                min="0"
                value={advance}
                onChange={(e) => setAdvance(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Initial Estimated Duration (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-amber-300/80 italic">
              Notice: Enter your actual room tariff before confirming. Hourly charges and advance deposits will automatically adjust on the final bill.
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-[#9f1119] hover:bg-[#b91c1c] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-md shadow-[#9f1119]/30"
            >
              <Plus className="w-4 h-4" />
              <span>Confirm & Register Booking</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Bookings List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
          <span>Active Bookings</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 text-xs font-mono border border-emerald-800">
            {activeBookings.length} Active
          </span>
        </h3>

        {activeBookings.length === 0 ? (
          <div className="p-8 text-center bg-[#14161f] border border-neutral-800 rounded-xl text-neutral-400 text-xs">
            No active private space bookings at the moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeBookings.map((b) => {
              const elapsed = getElapsedMinutes(b.start);
              const elapsedHours = (elapsed / 60).toFixed(1);
              const estimatedTotal = b.rate * b.hours;

              return (
                <div
                  key={b.id}
                  className="bg-[#151722] border border-neutral-800 rounded-xl p-4 flex flex-col justify-between shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white">{b.venue}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-black/40 text-[#d4af37] font-mono border border-[#d4af37]/30">
                            {b.id}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400 mt-1">
                          {b.venue === 'VIP Lounge' ? '2nd Floor' : '1st Floor'} · Started: {formatDateTime(b.start)}
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                        ACTIVE
                      </span>
                    </div>

                    <div className="my-3 p-3 bg-black/30 rounded-lg space-y-2 text-xs border border-white/5">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Guest Name:</span>
                        <span className="text-white font-semibold">{b.guest}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Mobile:</span>
                        <span className="text-neutral-300 font-mono">{b.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Hourly Rate:</span>
                        <span className="text-[#d4af37] font-mono font-semibold">{formatINR(b.rate)}/hr</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Advance Deposited:</span>
                        <span className="text-emerald-400 font-mono font-semibold">{formatINR(b.advance)}</span>
                      </div>

                      {/* Live Duration & Proration Progress */}
                      <div className="pt-2 border-t border-white/5 space-y-1.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-neutral-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
                            Duration: {elapsedHours}h of {b.hours}h booked
                          </span>
                          {elapsed > b.hours * 60 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/80 text-rose-300 border border-rose-700/60 font-bold animate-pulse">
                              +{( (elapsed - b.hours * 60) / 60 ).toFixed(1)}h Overtime
                            </span>
                          ) : (
                            <span className="text-neutral-400 font-mono text-[10px]">
                              {Math.max(0, b.hours * 60 - elapsed)}m remaining
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              elapsed > b.hours * 60
                                ? 'bg-rose-500'
                                : elapsed > b.hours * 45
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.round((elapsed / (b.hours * 60)) * 100))}%`,
                            }}
                          />
                        </div>

                        <div className="flex justify-between text-[11px] pt-0.5">
                          <span className="text-neutral-400">Prorated Space Tariff:</span>
                          <span className="text-white font-mono font-bold">
                            {formatINR(Math.max(b.hours, Math.ceil(elapsed / 60)) * b.rate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                    <button
                      onClick={() => onAttachOrder(b)}
                      className="flex-1 py-2 px-3 bg-[#d4af37] hover:bg-[#e5c158] text-black font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>Take Order for {b.venue}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onCloseBooking(b.id)}
                      className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Release
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past/Closed Bookings */}
      {closedBookings.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-neutral-800">
          <h3 className="text-xs font-bold text-neutral-400 tracking-wide uppercase">
            Closed Bookings Register ({closedBookings.length})
          </h3>
          <div className="space-y-2">
            {closedBookings.slice(0, 5).map((b) => (
              <div
                key={b.id}
                className="p-3 bg-[#13141c] border border-neutral-800 rounded-lg flex items-center justify-between text-xs text-neutral-400"
              >
                <div>
                  <span className="font-semibold text-neutral-200">{b.id} · {b.venue}</span>
                  <span className="ml-2">({b.guest})</span>
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span>Adv: {formatINR(b.advance)}</span>
                  <span className="text-neutral-500">CLOSED</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
