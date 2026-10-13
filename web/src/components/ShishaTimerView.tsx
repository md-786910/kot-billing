"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { KOT, Order } from '../types/pos';
import { formatINR } from '../utils/format';
import { Flame, Clock, PlusCircle, CheckCircle2, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';

interface ShishaTimerViewProps {
  kots: KOT[];
  orders: Order[];
  onAddDuration: (kotId: string, additionalMinutes: number) => void;
  onMarkServed: (kotId: string) => void;
}

export const ShishaTimerView: React.FC<ShishaTimerViewProps> = ({
  kots,
  orders,
  onAddDuration,
  onMarkServed,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'urgent' | 'active'>('active');

  // Trigger state re-render every 5 seconds for smooth countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  const shishaKots = useMemo(() => {
    return kots.filter((k) => k.station === 'Shisha Master');
  }, [kots]);

  const calculateTimerStatus = (kot: KOT) => {
    const createdTime = new Date(kot.created).getTime();
    const durationMinutes = kot.duration || 45;
    const durationMs = durationMinutes * 60 * 1000;
    const elapsedMs = Date.now() - createdTime;
    const remainingMs = durationMs - elapsedMs;
    const remainingMinutes = Math.round(remainingMs / 60000);
    const progressPercent = Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100));

    let statusText = 'Optimal Heat';
    let urgency: 'normal' | 'coal' | 'ending' | 'expired' = 'normal';

    if (remainingMs <= 0) {
      statusText = 'Session Expired';
      urgency = 'expired';
    } else if (remainingMinutes <= 10) {
      statusText = 'Ending Soon';
      urgency = 'ending';
    } else if (remainingMinutes <= 25) {
      statusText = 'Needs Coal Check / Refill';
      urgency = 'coal';
    }

    return {
      durationMinutes,
      remainingMinutes,
      progressPercent,
      statusText,
      urgency,
    };
  };

  const filteredShishas = shishaKots.filter((kot) => {
    const { urgency } = calculateTimerStatus(kot);
    const isCompleted = kot.status === 'SERVED';
    if (filterMode === 'active') return !isCompleted;
    if (filterMode === 'urgent') return !isCompleted && (urgency === 'coal' || urgency === 'ending' || urgency === 'expired');
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#12141d] border border-neutral-800 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-[#d4af37]" />
            <h2 className="text-xl font-extrabold text-white tracking-wide">Live Shisha Pot Timers</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time session monitoring, 45-min countdowns, and coal replenishment alerts for all active hookah pots.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-[#1a1d29] p-1 rounded-xl border border-neutral-800 text-xs font-semibold">
          <button
            onClick={() => setFilterMode('active')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              filterMode === 'active'
                ? 'bg-[#9f1119] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Active Sessions ({shishaKots.filter((k) => k.status !== 'SERVED').length})
          </button>
          <button
            onClick={() => setFilterMode('urgent')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              filterMode === 'urgent'
                ? 'bg-[#9f1119] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Need Coals ({shishaKots.filter((k) => {
              const { urgency } = calculateTimerStatus(k);
              return k.status !== 'SERVED' && (urgency === 'coal' || urgency === 'ending' || urgency === 'expired');
            }).length})
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              filterMode === 'all'
                ? 'bg-[#9f1119] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            All ({shishaKots.length})
          </button>
        </div>
      </div>

      {/* Grid of Shisha Timers */}
      {filteredShishas.length === 0 ? (
        <div className="p-16 text-center bg-[#12141d] border border-neutral-800 rounded-2xl shadow-inner">
          <Flame className="w-14 h-14 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-neutral-200">No active hookah pots</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            When an order with Shisha is punched, its 45-minute pot countdown timer will immediately appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredShishas.map((kot) => {
            const { durationMinutes, remainingMinutes, progressPercent, statusText, urgency } = calculateTimerStatus(kot);
            const parentOrder = orders.find((o) => o.id === kot.orderId);
            const isCompleted = kot.status === 'SERVED';

            return (
              <div
                key={kot.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between shadow-xl ${
                  isCompleted
                    ? 'bg-[#12131a] border-neutral-800 opacity-60'
                    : urgency === 'expired'
                    ? 'bg-[#220f12] border-red-600 shadow-red-950/40 ring-1 ring-red-500'
                    : urgency === 'coal'
                    ? 'bg-[#221a0f] border-amber-600 ring-1 ring-amber-500/40'
                    : urgency === 'ending'
                    ? 'bg-[#24131a] border-rose-600'
                    : 'bg-[#141622] border-neutral-800'
                }`}
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-extrabold text-white tracking-wide">{kot.location}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-black/60 text-[#d4af37] border border-[#d4af37]/30 font-mono font-bold">
                          {kot.id}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-300 mt-1">
                        Guest: <span className="font-semibold text-white">{kot.guest || parentOrder?.guest || 'Walk-in'}</span>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${
                        isCompleted
                          ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          : urgency === 'expired'
                          ? 'bg-red-950 text-red-300 border-red-600 animate-pulse'
                          : urgency === 'coal'
                          ? 'bg-amber-950 text-amber-300 border-amber-500'
                          : urgency === 'ending'
                          ? 'bg-rose-950 text-rose-300 border-rose-500'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-600'
                      }`}
                    >
                      {isCompleted ? 'Closed' : statusText}
                    </span>
                  </div>

                  {/* Big Timer Readout */}
                  {!isCompleted && (
                    <div className="my-4 p-4 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">
                          Time Remaining:
                        </div>
                        <div className="text-2xl font-mono font-extrabold mt-0.5">
                          {remainingMinutes > 0 ? (
                            <span
                              className={
                                urgency === 'coal'
                                  ? 'text-amber-400'
                                  : urgency === 'ending'
                                  ? 'text-rose-400'
                                  : 'text-emerald-400'
                              }
                            >
                              {remainingMinutes}m left
                            </span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1.5">
                              <AlertTriangle className="w-5 h-5" />
                              Overdue by {Math.abs(remainingMinutes)}m
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right text-xs text-neutral-400 font-mono">
                        <div>Target: {durationMinutes}m</div>
                        <div className="text-neutral-500">{Math.round(progressPercent)}% elapsed</div>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {!isCompleted && (
                    <div className="w-full h-2.5 bg-neutral-800/80 rounded-full overflow-hidden mb-4">
                      <div
                        className={`h-full transition-all duration-500 ${
                          urgency === 'expired'
                            ? 'bg-red-500'
                            : urgency === 'ending'
                            ? 'bg-rose-500'
                            : urgency === 'coal'
                            ? 'bg-amber-500'
                            : 'bg-[#d4af37]'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  {/* Items in this Shisha KOT */}
                  <div className="bg-[#12141e] rounded-xl p-3 my-3 space-y-1.5 border border-white/5">
                    {kot.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-white font-bold">{it.qty}x {it.name}</span>
                        <span className="text-neutral-400 font-mono">{formatINR(it.price * it.qty)}</span>
                      </div>
                    ))}
                    {kot.notes && (
                      <div className="text-xs text-amber-200 font-medium italic pt-1.5 border-t border-white/10">
                        Flavour Mix: {kot.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tactile Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                  {!isCompleted && (
                    <>
                      <button
                        onClick={() => onAddDuration(kot.id, 15)}
                        className="flex-1 py-3 px-3 bg-[#202538] hover:bg-[#2b3149] text-white rounded-xl text-xs font-bold border border-neutral-700 cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        title="Add 15 minutes session / coal time"
                      >
                        <PlusCircle className="w-4 h-4 text-amber-400" />
                        <span>+15m Coals</span>
                      </button>

                      <button
                        onClick={() => onMarkServed(kot.id)}
                        className="flex-1 py-3 px-3 bg-[#9f1119] hover:bg-[#b91c1c] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-[#9f1119]/30"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Close Pot</span>
                      </button>
                    </>
                  )}

                  {isCompleted && (
                    <div className="w-full text-center text-xs text-neutral-500 py-1">
                      Session closed & archived.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
