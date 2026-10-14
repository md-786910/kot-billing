'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { requestPrint } from '@/lib/print/printer';
import { Modal } from '@/components/auth/ui';

interface QueueJob {
  id: string;
  label: string;
  status: 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED';
  requestedBy?: string;
  requestedFrom?: string;
  error?: string;
  createdAt: string;
}

interface QueueState {
  station: { configured: boolean; online: boolean; name: string | null };
  pending: number;
  failed: number;
  oldestPendingAt: string | null;
  jobs: QueueJob[];
  /** Whether the oldest waiting slip has waited too long (worked out when the status loads) */
  stuck: boolean;
}

const STUCK_MS = 30_000;

/** Top-bar printer indicator for every terminal; opens the print queue with retry. */
export function PrinterStatus({ isStation }: { isStation: boolean }) {
  const [state, setState] = useState<QueueState | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/print');
      const json = await res.json();
      if (json.success) {
        const oldest = json.data.oldestPendingAt;
        setState({ ...json.data, stuck: !!oldest && Date.now() - new Date(oldest).getTime() > STUCK_MS });
      }
    } catch {
      // keep last known state
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 10_000);
    window.addEventListener('print-queue-changed', load);
    return () => {
      clearInterval(id);
      window.removeEventListener('print-queue-changed', load);
    };
  }, [load]);

  if (!state) return null;
  const problem = !state.station.configured || !state.station.online || state.failed > 0 || state.stuck;
  const label = !state.station.configured
    ? 'No printer set'
    : !state.station.online
    ? 'Printer offline'
    : state.failed > 0
    ? `${state.failed} failed`
    : state.pending > 0
    ? `${state.pending} printing`
    : isStation
    ? 'Printing here'
    : 'Printer ready';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Print queue"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer ${
          problem ? 'bg-rose-950/50 border-rose-800/70 text-rose-200' : 'bg-[#14161f] border-neutral-800 text-neutral-200 hover:text-white'
        }`}
        data-testid="printer-status"
      >
        <Printer className={`w-4 h-4 ${problem ? 'text-rose-300' : 'text-[#d4af37]'}`} />
        <span>{label}</span>
      </button>

      {open && (
        <Modal title="Print queue" onClose={() => setOpen(false)} width="max-w-lg">
          <p className="text-sm text-neutral-400 mb-4">
            {state.station.configured
              ? `${state.station.name} prints for every device${state.station.online ? '' : ' — it is offline. Check that it is on and Layali is open.'}`
              : 'No print station yet. An admin can choose one in Staff & Devices.'}
          </p>
          {state.jobs.length === 0 ? (
            <p className="text-sm text-neutral-400 py-6 text-center">Nothing printed in the last 12 hours.</p>
          ) : (
            <ul className="divide-y divide-neutral-800 max-h-[55vh] overflow-y-auto">
              {state.jobs.map((j) => (
                <li key={j.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-base text-white truncate">{j.label}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(j.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {j.requestedBy ? ` · ${j.requestedBy}` : ''}
                      {j.requestedFrom ? ` · ${j.requestedFrom}` : ''}
                      {j.error ? ` · ${j.error}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      j.status === 'PRINTED'
                        ? 'bg-emerald-950/60 text-emerald-300'
                        : j.status === 'FAILED'
                        ? 'bg-rose-950/60 text-rose-300'
                        : 'bg-amber-950/60 text-amber-300'
                    }`}
                  >
                    {j.status === 'PRINTED' ? 'Printed' : j.status === 'FAILED' ? 'Failed' : 'Waiting'}
                  </span>
                  {(j.status === 'FAILED' || j.status === 'PRINTED') && (
                    <button
                      onClick={() => requestPrint({ kind: 'retry', jobId: j.id }).then(load)}
                      className="h-10 px-3 rounded-lg border border-neutral-700 bg-[#1b1f2d] hover:bg-[#252b3d] text-sm font-semibold text-white cursor-pointer"
                    >
                      {j.status === 'FAILED' ? 'Retry' : 'Print again'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}
