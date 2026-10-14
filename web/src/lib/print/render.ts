import { billSlip, cancelSlip, kotSlip, printDocument, zReportSlip } from './templates';
import type { BillPrint, KotCopy, KotPrint, PrintSettings, ZReportPrint } from './templates';

export type PrintKind = 'kot' | 'cancel' | 'bill' | 'zreport';

export type PrintPayload =
  | { kind: 'kot'; kots: KotPrint[]; copies?: KotCopy[]; reprint?: boolean }
  | { kind: 'cancel'; kot: KotPrint; copies?: KotCopy[]; reprint?: boolean }
  | { kind: 'bill'; bill: BillPrint; settings: PrintSettings }
  | { kind: 'zreport'; zreport: ZReportPrint; settings: PrintSettings };

/** Printable document for a queued job (rendered by the print station). */
export function renderPrintJob(payload: PrintPayload): string {
  switch (payload.kind) {
    // Each station's ticket prints once per copy (station, staff, admin), each on its own cut
    case 'kot':
      return printDocument(
        payload.kots.flatMap((k) => (payload.copies ?? ['STATION']).map((c) => kotSlip(k, c, payload.reprint))),
        'KOT'
      );
    case 'cancel':
      return printDocument((payload.copies ?? ['STATION']).map((c) => cancelSlip(payload.kot, c, payload.reprint)), 'Cancel');
    case 'bill':
      return printDocument([billSlip(payload.bill, payload.settings)], 'Bill');
    case 'zreport':
      return printDocument([zReportSlip(payload.zreport, payload.settings)], 'Z-report');
  }
}

/** One-line description for queue lists, e.g. "KOT · Table 3 (3 slips)" */
export function describePrintJob(payload: PrintPayload): string {
  switch (payload.kind) {
    case 'kot': {
      const slips = payload.kots.length * (payload.copies?.length ?? 1);
      return `KOT${payload.reprint ? ' reprint' : ''} · ${payload.kots[0]?.table ?? ''}${slips > 1 ? ` (${slips} slips)` : ''}`;
    }
    case 'cancel':
      return `Cancel · ${payload.kot.table}${(payload.copies?.length ?? 1) > 1 ? ` (${payload.copies!.length} slips)` : ''}`;
    case 'bill':
      return `${payload.bill.invoiceNumber ? 'Receipt' : 'Bill'} · ${payload.bill.table}`;
    case 'zreport':
      return `Z-report · ${payload.zreport.shiftNumber}`;
  }
}
