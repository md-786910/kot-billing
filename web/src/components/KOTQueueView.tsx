"use client";
import React, { useState } from 'react';
import { KOT, Station, KOTStatus } from '../types/pos';
import { formatINR, formatDateTime, getElapsedMinutes } from '../utils/format';
import { Printer, Clock, ChefHat, GlassWater, Flame, CheckCircle, RefreshCcw, AlertTriangle } from 'lucide-react';

interface KOTQueueViewProps {
  kots: KOT[];
  onStatusChange: (kotId: string, newStatus: KOTStatus) => void;
  onPrintKot: (kot: KOT) => void;
}

export const KOTQueueView: React.FC<KOTQueueViewProps> = ({
  kots,
  onStatusChange,
  onPrintKot,
}) => {
  const [selectedStation, setSelectedStation] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE_ALL');

  const stationsList: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: 'All Stations', value: 'All', icon: <ChefHat className="w-4 h-4" /> },
    { label: 'Kitchen', value: 'Kitchen', icon: <ChefHat className="w-4 h-4 text-emerald-400" /> },
    { label: 'Beverage Counter', value: 'Beverage Counter', icon: <GlassWater className="w-4 h-4 text-sky-400" /> },
    { label: 'Shisha Master', value: 'Shisha Master', icon: <Flame className="w-4 h-4 text-amber-400" /> },
  ];

  const filteredKots = kots.filter((k) => {
    if (selectedStation !== 'All' && k.station !== selectedStation) return false;
    if (selectedStatus === 'ACTIVE_ALL') return k.status !== 'SERVED';
    if (selectedStatus !== 'All' && k.status !== selectedStatus) return false;
    return true;
  });

  const getStationStyle = (st: Station) => {
    switch (st) {
      case 'Kitchen':
        return {
          badge: 'text-emerald-300 bg-emerald-950 border-emerald-700',
          border: 'border-emerald-800/60',
          headerBg: 'bg-emerald-950/30',
        };
      case 'Beverage Counter':
        return {
          badge: 'text-sky-300 bg-sky-950 border-sky-700',
          border: 'border-sky-800/60',
          headerBg: 'bg-sky-950/30',
        };
      case 'Shisha Master':
        return {
          badge: 'text-amber-300 bg-amber-950 border-amber-700',
          border: 'border-amber-800/60',
          headerBg: 'bg-amber-950/30',
        };
    }
  };

  const getStatusBadge = (status: KOTStatus) => {
    switch (status) {
      case 'NEW':
        return 'text-rose-200 bg-rose-950 border-rose-600 animate-pulse';
      case 'PREPARING':
        return 'text-amber-200 bg-amber-950 border-amber-600';
      case 'READY':
        return 'text-emerald-200 bg-emerald-950 border-emerald-600';
      case 'SERVED':
        return 'text-neutral-400 bg-neutral-900 border-neutral-700';
      case 'CANCELLED':
        return 'text-rose-200 bg-rose-950 border-rose-600 font-extrabold';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Station Bar */}
      <div className="bg-[#12141d] border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        {/* Station Selectors */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {stationsList.map((st) => (
            <button
              key={st.value}
              onClick={() => setSelectedStation(st.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                selectedStation === st.value
                  ? 'bg-[#9f1119] text-white shadow-md shadow-[#9f1119]/30'
                  : 'bg-[#1a1d29] text-neutral-300 hover:bg-[#252a3b] border border-neutral-800'
              }`}
            >
              {st.icon}
              <span>{st.label}</span>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-black/50 text-[11px] font-mono font-bold text-[#d4af37]">
                {st.value === 'All'
                  ? kots.filter((k) => k.status !== 'SERVED').length
                  : kots.filter((k) => k.station === st.value && k.status !== 'SERVED').length}
              </span>
            </button>
          ))}
        </div>

        {/* Status Selectors */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-300 font-bold whitespace-nowrap">Status Filter:</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3.5 py-2 bg-[#1a1d29] text-white border border-neutral-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#d4af37]"
          >
            <option value="ACTIVE_ALL">Active Orders (New, Preparing, Ready)</option>
            <option value="NEW">NEW ONLY</option>
            <option value="PREPARING">PREPARING ONLY</option>
            <option value="READY">READY ONLY</option>
            <option value="SERVED">SERVED (Completed History)</option>
            <option value="All">All KOTs</option>
          </select>
        </div>
      </div>

      {/* High-Readability KDS Ticket Grid */}
      {filteredKots.length === 0 ? (
        <div className="p-16 text-center bg-[#12141d] border border-neutral-800 rounded-2xl shadow-inner">
          <ChefHat className="w-14 h-14 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-neutral-200">KOT Queue is clear!</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            All tickets for this station have been served. New orders placed from the POS counter will pop up here instantly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredKots.map((kot) => {
            const elapsed = getElapsedMinutes(kot.created);
            const style = getStationStyle(kot.station);
            const isDelayed = elapsed > 20 && kot.status !== 'SERVED';

            return (
              <div
                key={kot.id}
                className={`bg-[#141622] border rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl transition-all ${
                  isDelayed ? 'border-red-600 ring-1 ring-red-500/30' : style.border
                }`}
              >
                {/* Header: Large Table Name & Timers */}
                <div className={`p-4 border-b border-white/10 ${style.headerBg}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xl font-extrabold text-white tracking-wide">
                        {kot.location}
                      </div>
                      <div className="text-xs text-neutral-300 mt-0.5">
                        KOT <strong className="text-[#d4af37] font-mono">{kot.id}</strong> · Order #{kot.orderId}
                      </div>
                      {kot.guest && (
                        <div className="text-xs text-neutral-300 mt-0.5">
                          Guest: <span className="font-semibold text-white">{kot.guest}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${getStatusBadge(kot.status)}`}>
                        {kot.status}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${style.badge}`}>
                        {kot.station}
                      </span>
                    </div>
                  </div>

                  {/* Elapsed Time Banner */}
                  <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-white/10">
                    <span className="flex items-center gap-1.5 text-neutral-300">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      {formatDateTime(kot.created).split(',')[0]}
                    </span>

                    <span
                      className={`font-mono font-bold flex items-center gap-1 px-2 py-0.5 rounded ${
                        isDelayed
                          ? 'bg-red-950 text-red-300 border border-red-700'
                          : elapsed > 10
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {isDelayed && <AlertTriangle className="w-3 h-3 text-red-400" />}
                      <span>{elapsed}m ago</span>
                    </span>
                  </div>
                </div>

                {/* Items to Cook / Prepare: High Legibility Text */}
                <div className="p-4 space-y-2.5 flex-1 bg-[#12141e]">
                  <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-extrabold mb-2">
                    Items to Prepare:
                  </div>

                  {kot.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-[#191c28] border border-white/5 rounded-xl flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-black text-[#d4af37] border border-[#d4af37]/40 font-mono font-extrabold text-sm flex items-center justify-center shrink-0">
                          {it.qty}
                        </span>
                        <div>
                          <div className="font-extrabold text-white text-base leading-snug">
                            {it.name}
                          </div>
                          {it.notes && (
                            <div className="text-xs text-amber-300 font-medium italic mt-0.5">
                              Note: {it.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <span className="text-xs font-mono text-neutral-400 shrink-0">
                        {formatINR(it.price * it.qty)}
                      </span>
                    </div>
                  ))}

                  {/* Special Preparation / Allergen / Flavor Notes */}
                  {kot.notes && (
                    <div className="p-3 bg-amber-950/40 border border-amber-600 rounded-xl text-xs text-amber-100 shadow-inner">
                      <span className="font-extrabold uppercase tracking-wider text-[11px] block text-amber-300 mb-0.5">
                        ★ Special Customer Note:
                      </span>
                      {kot.notes}
                    </div>
                  )}

                  {kot.station === 'Shisha Master' && kot.duration && (
                    <div className="p-2.5 bg-[#1e1910] border border-amber-600/60 rounded-xl text-xs text-amber-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Flame className="w-4 h-4 text-amber-400" />
                        Session Target:
                      </span>
                      <span className="font-bold text-white font-mono text-sm">{kot.duration} minutes</span>
                    </div>
                  )}
                </div>

                {/* Tactile Action Buttons: Large Touch Targets for Kitchen & Bar */}
                <div className="p-3.5 bg-[#0e1017] border-t border-white/10 flex items-center gap-2">
                  <button
                    onClick={() => onPrintKot(kot)}
                    className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-xl cursor-pointer transition-colors shadow-sm"
                    title="Print 4-inch Thermal KOT Receipt"
                  >
                    <Printer className="w-4 h-4 text-[#d4af37]" />
                  </button>

                  {kot.status === 'CANCELLED' ? (
                    <div className="flex-1 p-2 bg-rose-950/80 border border-rose-600 rounded-xl text-center text-xs font-bold text-rose-200">
                      ⛔ VOID TICKET: PREPARATION CANCELLED
                    </div>
                  ) : (
                    <div className="flex-1 grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => onStatusChange(kot.id, 'PREPARING')}
                        disabled={kot.status === 'PREPARING'}
                        className={`py-2.5 text-xs font-extrabold rounded-xl cursor-pointer transition-all text-center ${
                          kot.status === 'PREPARING'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'bg-[#1d2130] text-neutral-200 hover:bg-amber-900/60 hover:text-amber-100 border border-neutral-700'
                        }`}
                      >
                        Prep
                      </button>
                      <button
                        onClick={() => onStatusChange(kot.id, 'READY')}
                        disabled={kot.status === 'READY'}
                        className={`py-2.5 text-xs font-extrabold rounded-xl cursor-pointer transition-all text-center ${
                          kot.status === 'READY'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-[#1d2130] text-neutral-200 hover:bg-emerald-900/60 hover:text-emerald-100 border border-neutral-700'
                        }`}
                      >
                        Ready
                      </button>
                      <button
                        onClick={() => onStatusChange(kot.id, 'SERVED')}
                        disabled={kot.status === 'SERVED'}
                        className={`py-2.5 text-xs font-extrabold rounded-xl cursor-pointer transition-all text-center ${
                          kot.status === 'SERVED'
                            ? 'bg-neutral-800 text-neutral-500'
                            : 'bg-[#1d2130] text-neutral-200 hover:bg-neutral-700 border border-neutral-700'
                        }`}
                      >
                        Served
                      </button>
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
