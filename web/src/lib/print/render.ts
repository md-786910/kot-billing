import { billSlip, cancelSlip, kotSlip, printDocument, zReportSlip } from './templates';
import type { BillPrint, KotPrint, PrintSettings, ZReportPrint } from './templates';

export type PrintKind = 'kot' | 'cancel' | 'bill' | 'zreport';

export type PrintPayload =
  | { kind: 'kot'; kots: KotPrint[] }
  | { kind: 'cancel'; kot: KotPrint }
  | { kind: 'bill'; bill: BillPrint; settings: PrintSettings }
  | { kind: 'zreport'; zreport: ZReportPrint; settings: PrintSettings };

/** Printable document for a queued job (rendered by the print station). */
export function renderPrintJob(payload: PrintPayload): string {
  switch (payload.kind) {
    case 'kot':
      return printDocument(payload.kots.map(kotSlip), 'KOT');
    case 'cancel':
      return printDocument([cancelSlip(payload.kot)], 'Cancel');
    case 'bill':
      return printDocument([billSlip(payload.bill, payload.settings)], 'Bill');
    case 'zreport':
      return printDocument([zReportSlip(payload.zreport, payload.settings)], 'Z-report');
  }
}

/** One-line description for queue lists, e.g. "KOT · Table 3 (3 slips)" */
export function describePrintJob(payload: PrintPayload): string {
  switch (payload.kind) {
    case 'kot':
      return `KOT · ${payload.kots[0]?.table ?? ''}${payload.kots.length > 1 ? ` (${payload.kots.length} slips)` : ''}`;
    case 'cancel':
      return `Cancel · ${payload.kot.table}`;
    case 'bill':
      return `${payload.bill.invoiceNumber ? 'Receipt' : 'Bill'} · ${payload.bill.table}`;
    case 'zreport':
      return `Z-report · ${payload.zreport.shiftNumber}`;
  }
}
