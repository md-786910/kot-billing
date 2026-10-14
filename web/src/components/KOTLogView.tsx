'use client';

import React, { useMemo, useState } from 'react';
import { Printer, Search } from 'lucide-react';
import { KOT } from '@/types/pos';
import { requestPrint } from '@/lib/print/printer';

const STATIONS = [
  { key: 'All', label: 'All' },
  { key: 'Kitchen', label: 'Kitchen' },
  { key: 'Beverage Counter', label: 'Bar' },
  { key: 'Shisha Master', label: 'Shisha' },
] as const;

const STATION_STYLE: Record<string, string> = {
  Kitchen: 'text-emerald-300 bg-emerald-950/60 border-emerald-800/60',
  'Beverage Counter': 'text-sky-300 bg-sky-950/60 border-sky-800/60',
  'Shisha Master': 'text-amber-300 bg-amber-950/60 border-amber-800/60',
};

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Every KOT printed today, newest first, with reprint. Cancel slips reprint as cancel slips. */
export function KOTLogView({ kots }: { kots: KOT[] }) {
  const [station, setStation] = useState<(typeof STATIONS)[number]['key']>('All');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...kots]
      .filter((k) => station === 'All' || k.station === station)
      .filter((k) => !q || k.location.toLowerCase().includes(q) || (k.kotNumber ?? '').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }, [kots, station, query]);

  const isCancel = (k: KOT) => k.status === 'CANCELLED' || (k.kotNumber ?? '').startsWith('VOID-');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-[220px] max-w-md">
          <span className="sr-only">Search by table or KOT number</span>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Table or KOT number"
            className="w-full h-12 pl-11 pr-3 rounded-xl bg-[#0d0f15] border border-neutral-700 text-base text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#d4af37]"
          />
        </label>
        <div className="flex gap-2" role="tablist" aria-label="Station">
          {STATIONS.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={station === s.key}
              onClick={() => setStation(s.key)}
              className={`h-12 px-4 rounded-xl text-sm font-semibold cursor-pointer border ${
                station === s.key ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-[#1b1f2d] text-neutral-300 border-neutral-700 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-base text-neutral-400">No KOTs yet. They appear here as orders are punched.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="kot-log">
          {visible.map((k) => {
            const cancel = isCancel(k);
            return (
              <li
                key={k.id}
                className={`rounded-2xl border bg-[#12141e] p-4 flex flex-col gap-3 ${cancel ? 'border-rose-900/70' : 'border-neutral-800'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold text-white">{k.location}</p>
                    <p className="text-sm text-neutral-400">
                      {k.kotNumber} · {timeOf(k.created)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md border text-xs font-bold ${STATION_STYLE[k.station] ?? ''}`}>
                      {k.station === 'Beverage Counter' ? 'Bar' : k.station === 'Shisha Master' ? 'Shisha' : 'Kitchen'}
                    </span>
                    {cancel && <span className="px-2 py-0.5 rounded-md border border-rose-800/60 bg-rose-950/60 text-rose-300 text-xs font-bold">Cancelled</span>}
                  </div>
                </div>
                <ul className="space-y-1">
                  {k.items.map((it, i) => (
                    <li key={i} className={`text-base ${cancel ? 'text-neutral-400 line-through' : 'text-neutral-100'}`}>
                      <span className="font-bold text-[#d4af37] tabular-nums">{it.qty}×</span> {it.name}
                      {it.notes && <span className="block pl-7 text-sm text-amber-300 no-underline">{it.notes}</span>}
                    </li>
                  ))}
                </ul>
                {k.notes && <p className="text-sm text-amber-300">{k.notes}</p>}
                <button
                  onClick={() => requestPrint({ kind: 'kot', kotId: k.kotNumber ?? k.id })}
                  className="mt-auto h-11 rounded-xl border border-neutral-700 bg-[#1b1f2d] hover:bg-[#252b3d] text-sm font-semibold text-white inline-flex items-center justify-center gap-2 cursor-pointer"
                  data-testid={`reprint-${k.kotNumber}`}
                >
                  <Printer className="w-4 h-4" /> Reprint
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
