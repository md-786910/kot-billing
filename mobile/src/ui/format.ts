/** ₹1,234 or ₹1,234.50 — Indian digit grouping, decimals only when needed */
export function formatMoney(value: number): string {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  const hasPaise = Math.abs(rounded % 1) > 0.001;
  return `₹${rounded.toLocaleString('en-IN', { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "Just now", "12 min", "1 h 05 min" since an ISO time */
export function formatElapsed(fromIso: string | undefined, now = Date.now()): string {
  if (!fromIso) return '';
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `${h} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** Minutes elapsed since an ISO time */
export function minutesSince(fromIso: string | undefined, now = Date.now()): number {
  if (!fromIso) return 0;
  return Math.max(0, (now - new Date(fromIso).getTime()) / 60000);
}
