import { request } from './api';

// ---------- Private bookings ----------

export type BookingVenue = 'VIP Lounge' | 'Couple Cabin';
export const BOOKING_VENUES: BookingVenue[] = ['VIP Lounge', 'Couple Cabin'];

export interface PrivateBooking {
  id: string;
  bookingNumber: string;
  venue: BookingVenue;
  guest: string;
  phone: string;
  rate: number;
  advance: number;
  hours: number;
  notes: string;
  status: 'ACTIVE' | 'CLOSED';
  start: string;
  end?: string;
  createdAt?: string;
}

function toBooking(b: any): PrivateBooking {
  return {
    id: String(b._id ?? b.id ?? b.bookingNumber),
    bookingNumber: b.bookingNumber,
    venue: b.venue,
    guest: b.guest ?? '',
    phone: b.phone ?? '',
    rate: Number(b.rate) || 0,
    advance: Number(b.advance) || 0,
    hours: Number(b.hours) || 0,
    notes: b.notes ?? '',
    status: b.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
    start: b.start ?? b.createdAt,
    end: b.end ?? undefined,
    createdAt: b.createdAt,
  };
}

/** All bookings, newest first */
export async function fetchBookings(): Promise<PrivateBooking[]> {
  const json = await request<any[]>('/api/v1/bookings');
  return (json.data ?? []).map(toBooking);
}

/** Throws ApiError 409 when the venue already has an active booking */
export async function createBooking(params: {
  venue: BookingVenue;
  guest: string;
  phone: string;
  rate: number;
  advance: number;
  hours: number;
  notes?: string;
}): Promise<PrivateBooking> {
  const json = await request<any>('/api/v1/bookings', { method: 'POST', body: params });
  return toBooking(json.data ?? params);
}

/** Closes (releases) a booking by its booking number */
export async function releaseBooking(bookingNumber: string): Promise<void> {
  await request('/api/v1/bookings', { method: 'PATCH', body: { bookingId: bookingNumber } });
}

// ---------- Cash drawer shifts ----------

export interface CashDrop {
  amount: number;
  reason: string;
  staff: string;
  timestamp: string;
}

export interface Shift {
  id: string;
  shiftNumber: string;
  openedBy: string;
  openingFloat: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  closedBy?: string;
  closingCashActual?: number;
  expectedCash: number;
  cashDifference?: number;
  totalSales: number;
  totalCash: number;
  totalUpi: number;
  totalCard: number;
  totalCredit: number;
  totalDiscount: number;
  totalTax: number;
  ordersCount: number;
  cashDrops: CashDrop[];
  notes: string;
}

const num = (v: unknown) => Number(v) || 0;

function toShift(s: any): Shift {
  return {
    id: String(s._id ?? s.id ?? s.shiftNumber),
    shiftNumber: s.shiftNumber,
    openedBy: s.openedBy ?? '',
    openingFloat: num(s.openingFloat),
    status: s.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    openedAt: s.openedAt,
    closedAt: s.closedAt ?? undefined,
    closedBy: s.closedBy ?? undefined,
    closingCashActual: s.closingCashActual ?? undefined,
    expectedCash: num(s.expectedCash),
    cashDifference: s.cashDifference ?? undefined,
    totalSales: num(s.totalSales),
    totalCash: num(s.totalCash),
    totalUpi: num(s.totalUpi),
    totalCard: num(s.totalCard),
    totalCredit: num(s.totalCredit),
    totalDiscount: num(s.totalDiscount),
    totalTax: num(s.totalTax),
    ordersCount: num(s.ordersCount),
    cashDrops: Array.isArray(s.cashDrops) ? s.cashDrops : [],
    notes: s.notes ?? '',
  };
}

/** The open shift (with live totals) and the last 10 closed shifts */
export async function fetchShifts(): Promise<{ currentShift: Shift | null; pastShifts: Shift[] }> {
  // This route returns currentShift / pastShifts at the top level, not under `data`
  const json = (await request('/api/v1/shifts')) as { currentShift?: any; pastShifts?: any[] };
  return {
    currentShift: json.currentShift ? toShift(json.currentShift) : null,
    pastShifts: (json.pastShifts ?? []).map(toShift),
  };
}

export async function openShift(openingFloat: number, notes = ''): Promise<void> {
  await request('/api/v1/shifts', { method: 'POST', body: { action: 'open', openingFloat, notes } });
}

export async function addCashDrop(amount: number, reason: string): Promise<void> {
  await request('/api/v1/shifts', { method: 'POST', body: { action: 'drop', amount, reason } });
}

/** Closes the shift; the server queues the Z-report at the counter printer */
export async function closeShift(closingCashActual: number, notes = ''): Promise<void> {
  await request('/api/v1/shifts', { method: 'POST', body: { action: 'close', closingCashActual, notes } });
}

export async function printZReport(shiftNumber: string): Promise<void> {
  await request('/api/v1/print', { method: 'POST', body: { kind: 'zreport', shiftId: shiftNumber } });
}
