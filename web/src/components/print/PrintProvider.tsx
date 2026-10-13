'use client';

import React, { createContext, useContext } from 'react';
import type { AppSettings } from '@/types/pos';
import { printHtml } from '@/lib/print/printer';
import {
  BillPrint,
  KotPrint,
  ZReportPrint,
  billSlip,
  cancelSlip,
  kotSlip,
  printDocument,
  zReportSlip,
} from '@/lib/print/templates';

/* eslint-disable @typescript-eslint/no-explicit-any -- adapters accept both API documents and screen models */

/** KOT from the API (tableName/createdAt) or from the screen model (location/created) */
export function toKotPrint(k: any): KotPrint {
  return {
    kotNumber: k.kotNumber ?? k.id,
    table: k.tableName ?? k.location ?? '',
    station: k.station,
    items: (k.items ?? []).map((it: any) => ({ name: it.name, qty: it.qty, notes: it.notes })),
    notes: k.notes,
    duration: k.duration,
    created: k.createdAt ?? k.created ?? new Date().toISOString(),
    orderNumber: k.orderNumber,
    staff: k.staffName,
  };
}

/** Order from the API (tableName/staffName) or from the screen model (location/staff) */
export function toBillPrint(o: any, booking?: BillPrint['booking']): BillPrint {
  return {
    orderNumber: o.orderNumber,
    invoiceNumber: o.invoiceNumber,
    table: o.tableName ?? o.location ?? '',
    staff: o.staffName ?? o.staff,
    guest: o.guestName ?? o.guest,
    created: o.createdAt ?? o.created,
    closedAt: o.closedAt,
    items: o.items ?? [],
    discountAmount: o.discountAmount ?? 0,
    discountReason: o.discountReason,
    taxPercent: o.taxPercent ?? 0,
    shishaAdvance: o.shishaAdvance ?? 0,
    payments: (o.payments ?? []).map((p: any) => ({ amount: p.amount, method: p.method })),
    booking: booking ?? null,
  };
}

export interface Printer {
  printKots: (kots: any[]) => void;
  printCancel: (voidKot: any) => void;
  printBill: (order: any, booking?: BillPrint['booking']) => void;
  printZReport: (shift: ZReportPrint) => void;
}

const PrintContext = createContext<Printer | null>(null);

export function usePrinter(): Printer {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error('usePrinter must be used inside <PrintProvider>');
  return ctx;
}

/** One counter printer: KOTs (one slip per station), cancel slips, customer bills and Z-reports. */
export function createPrinter(settings: AppSettings): Printer {
  return {
    printKots: (kots) => {
      if (kots.length) printHtml(printDocument(kots.map((k) => kotSlip(toKotPrint(k))), 'KOT'));
    },
    printCancel: (voidKot) => {
      if (voidKot) printHtml(printDocument([cancelSlip(toKotPrint(voidKot))], 'Cancel'));
    },
    printBill: (order, booking) => printHtml(printDocument([billSlip(toBillPrint(order, booking), settings)], 'Bill')),
    printZReport: (shift) => printHtml(printDocument([zReportSlip(shift, settings)], 'Z-report')),
  };
}

export function PrintProvider({ printer, children }: { printer: Printer; children: React.ReactNode }) {
  return <PrintContext.Provider value={printer}>{children}</PrintContext.Provider>;
}
