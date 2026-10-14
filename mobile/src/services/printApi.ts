import { request, SLOW_REQUEST_TIMEOUT_MS } from './api';

/**
 * Counter printer. Phones never print: the server queues slips and the counter's print station prints them.
 * KOTs, cancel slips, receipts and Z-reports are queued by the server automatically; these calls are
 * for the status line and for reprints.
 */

export type PrintJobStatus = 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED';

export interface PrintJob {
  id: string;
  label: string;
  status: PrintJobStatus;
  requestedBy?: string | null;
  requestedFrom?: string | null;
  error?: string | null;
  createdAt: string;
}

export interface PrintStation {
  configured: boolean;
  online: boolean;
  name: string | null;
}

export interface PrintStatus {
  station: PrintStation;
  /** Jobs waiting or printing */
  pending: number;
  failed: number;
  /** Oldest job still waiting, ISO time */
  oldestPendingAt: string | null;
  /** Last 12 hours, newest first */
  jobs: PrintJob[];
}

// Anything that asks for a print refreshes the shared print status (see usePrintStatus)
const requestListeners = new Set<() => void>();

export function onPrintRequested(listener: () => void): () => void {
  requestListeners.add(listener);
  return () => {
    requestListeners.delete(listener);
  };
}

function notifyPrintRequested() {
  requestListeners.forEach((fn) => fn());
}

async function postPrint(body: Record<string, unknown>): Promise<void> {
  try {
    await request('/api/v1/print', { method: 'POST', body, timeoutMs: SLOW_REQUEST_TIMEOUT_MS });
  } finally {
    notifyPrintRequested();
  }
}

export async function fetchPrintStatus(): Promise<PrintStatus> {
  const json = await request<any>('/api/v1/print');
  const d = json.data ?? {};
  return {
    station: {
      configured: !!d.station?.configured,
      online: !!d.station?.online,
      name: d.station?.name ?? null,
    },
    pending: Number(d.pending) || 0,
    failed: Number(d.failed) || 0,
    oldestPendingAt: d.oldestPendingAt ?? null,
    jobs: (d.jobs ?? []).map((j: any) => ({
      id: String(j.id ?? j._id),
      label: j.label || 'Print job',
      status: j.status,
      requestedBy: j.requestedBy ?? null,
      requestedFrom: j.requestedFrom ?? null,
      error: j.error || null,
      createdAt: j.createdAt,
    })),
  };
}

/** Print the bill for an order at the counter (needs `bill.settle`) */
export function requestBillPrint(orderId: string) {
  return postPrint({ kind: 'bill', orderId });
}

/** Reprint a KOT by its number (needs `order.create`). Void dockets reprint as cancel slips. */
export function requestKotReprint(kotNumber: string) {
  return postPrint({ kind: 'kot', kotId: kotNumber });
}

/** Put a failed or printed job back in the queue. Throws 409 if it is already waiting. */
export function retryPrintJob(jobId: string) {
  return postPrint({ kind: 'retry', jobId });
}
