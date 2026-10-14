import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { usePOS } from '../context/POSContext';
import { fetchPrintStatus, onPrintRequested, PrintStatus } from '../services/printApi';

const POLL_MS = 15_000;
/** A slip still waiting after this long means the counter printer is stuck */
const STUCK_MS = 30_000;

export type PrintProblem = 'not_configured' | 'offline' | 'failed' | 'stuck' | null;

// ---------- Shared store: one poller however many components use the hook ----------

let current: PrintStatus | null = null;
const subscribers = new Set<() => void>();
let users = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;
let again = false;

function emit() {
  subscribers.forEach((fn) => fn());
}

function load(): Promise<void> {
  if (inFlight) {
    // A print was just requested while a poll was running: fetch once more afterwards
    again = true;
    return inFlight;
  }
  inFlight = fetchPrintStatus()
    .then((s) => {
      current = s;
      emit();
    })
    .catch(() => {
      // Keep the last known status; the offline banner covers network problems
    })
    .finally(() => {
      inFlight = null;
      if (again && users > 0) {
        again = false;
        load();
      }
    });
  return inFlight;
}

onPrintRequested(() => {
  if (users > 0) load();
});

function start() {
  users += 1;
  if (users === 1) {
    load();
    timer = setInterval(load, POLL_MS);
  }
}

function stop() {
  users = Math.max(0, users - 1);
  if (users === 0 && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

const getSnapshot = () => current;

// ---------- Problem ----------

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function printProblem(status: PrintStatus | null, now = Date.now()): { problem: PrintProblem; message: string | null } {
  if (!status) return { problem: null, message: null };
  if (!status.station.configured) {
    return { problem: 'not_configured', message: 'No counter printer set. Ask the owner to choose one in Devices.' };
  }
  if (!status.station.online) {
    return { problem: 'offline', message: "Counter printer is offline. Slips will print when it's back." };
  }
  if (status.failed > 0) {
    return { problem: 'failed', message: `${plural(status.failed, 'slip')} failed to print.` };
  }
  const oldest = status.oldestPendingAt ? new Date(status.oldestPendingAt).getTime() : NaN;
  if (status.pending > 0 && Number.isFinite(oldest) && now - oldest > STUCK_MS) {
    return { problem: 'stuck', message: `Counter printer hasn't printed ${plural(status.pending, 'slip')}.` };
  }
  return { problem: null, message: null };
}

/** Not set up yet or merely slow is a warning; offline or failed slips need action now */
export function problemTone(problem: PrintProblem): 'warning' | 'danger' {
  return problem === 'not_configured' || problem === 'stuck' ? 'warning' : 'danger';
}

/**
 * Counter printer status, polled every 15 s while a signed-in screen uses it.
 * All users share one poll; any print request refreshes it straight away.
 */
export function usePrintStatus() {
  const { authStatus } = usePOS();
  const enabled = authStatus === 'ready';
  const status = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!enabled) return;
    start();
    return stop;
  }, [enabled]);

  const refresh = useCallback(() => load(), []);
  const { problem, message } = printProblem(enabled ? status : null);

  return { status: enabled ? status : null, problem, message, tone: problemTone(problem), refresh };
}
