'use client';

import { useEffect } from 'react';
import { printHtml } from '@/lib/print/printer';
import { renderPrintJob, PrintPayload } from '@/lib/print/render';

// Slips print within ~3 s; each poll is one server call (keeps serverless usage low)
const POLL_MS = 3000;

interface ClaimedJob {
  id: string;
  label: string;
  payload: PrintPayload;
}

async function report(id: string, ok: boolean, error?: string) {
  await fetch('/api/v1/print/station', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ok, error }),
  }).catch(() => {});
}

/**
 * Runs on the counter computer marked as print station (also while its screen is locked):
 * claims queued slips from every device, prints them one by one, and confirms each.
 */
export function PrintStation() {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const cycle = async () => {
      try {
        const res = await fetch('/api/v1/print/station', { method: 'POST' });
        const json = await res.json();
        for (const job of (json.success ? json.data : []) as ClaimedJob[]) {
          if (stopped) break;
          try {
            await printHtml(renderPrintJob(job.payload));
            await report(job.id, true);
          } catch (error) {
            await report(job.id, false, error instanceof Error ? error.message : 'Print failed');
          }
        }
      } catch {
        // Server unreachable: try again on the next cycle
      }
      if (!stopped) timer = setTimeout(cycle, POLL_MS);
    };

    cycle();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return null;
}
