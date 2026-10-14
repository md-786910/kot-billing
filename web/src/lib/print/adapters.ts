/* eslint-disable @typescript-eslint/no-explicit-any -- adapters accept both API documents and screen models */
import type { BillPrint, KotPrint, PrintSettings, ZReportPrint } from './templates';

/** KOT from the database (tableName/createdAt) or a screen model (location/created) */
export function toKotPrint(k: any): KotPrint {
  return {
    kotNumber: k.kotNumber ?? k.id,
    table: k.tableName ?? k.location ?? '',
    station: k.station,
    items: (k.items ?? []).map((it: any) => ({ name: it.name, qty: it.qty, notes: it.notes })),
    notes: k.notes,
    duration: k.duration,
    created: new Date(k.createdAt ?? k.created ?? Date.now()).toISOString(),
    orderNumber: k.orderNumber,
    staff: k.staffName,
  };
}

/** Order from the database (tableName/staffName) or a screen model (location/staff) */
export function toBillPrint(o: any, booking?: BillPrint['booking']): BillPrint {
  const iso = (d: any) => (d ? new Date(d).toISOString() : undefined);
  return {
    orderNumber: o.orderNumber,
    invoiceNumber: o.invoiceNumber,
    table: o.tableName ?? o.location ?? '',
    staff: o.staffName ?? o.staff,
    guest: o.guestName ?? o.guest,
    created: iso(o.createdAt ?? o.created) ?? new Date().toISOString(),
    closedAt: iso(o.closedAt),
    items: (o.items ?? []).map((it: any) => ({ name: it.name, price: it.price, qty: it.qty, isVoided: !!it.isVoided })),
    discountAmount: o.discountAmount ?? 0,
    discountReason: o.discountReason,
    taxPercent: o.taxPercent ?? 0,
    shishaAdvance: o.shishaAdvance ?? 0,
    payments: (o.payments ?? []).map((p: any) => ({ amount: p.amount, method: p.method })),
    booking: booking ?? null,
  };
}

export function toZReportPrint(s: any): ZReportPrint {
  const iso = (d: any) => (d ? new Date(d).toISOString() : undefined);
  return {
    shiftNumber: s.shiftNumber,
    openedBy: s.openedBy,
    closedBy: s.closedBy,
    openedAt: iso(s.openedAt) ?? new Date().toISOString(),
    closedAt: iso(s.closedAt),
    openingFloat: s.openingFloat ?? 0,
    totalSales: s.totalSales ?? 0,
    totalCash: s.totalCash ?? 0,
    totalUpi: s.totalUpi ?? 0,
    totalCard: s.totalCard ?? 0,
    totalCredit: s.totalCredit ?? 0,
    totalDiscount: s.totalDiscount ?? 0,
    totalTax: s.totalTax ?? 0,
    ordersCount: s.ordersCount ?? 0,
    cashDrops: (s.cashDrops ?? []).map((d: any) => ({ amount: d.amount, reason: d.reason })),
    expectedCash: s.expectedCash,
    closingCashActual: s.closingCashActual,
    cashDifference: s.cashDifference,
  };
}

export function toPrintSettings(s: any): PrintSettings {
  return {
    loungeName: s?.loungeName ?? 'LAYALI SHISHA LOUNGE',
    tagline: s?.tagline ?? '',
    address: s?.address ?? '',
    phone: s?.phone ?? '',
    gstNumber: s?.gstNumber ?? '',
  };
}
