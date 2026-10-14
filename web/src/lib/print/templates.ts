/**
 * 80 mm thermal print templates (KOT, cancel slip, customer bill, Z-report).
 * Pure functions returning HTML so they can be printed from an isolated frame and tested directly.
 */

export interface PrintSettings {
  loungeName: string;
  tagline?: string;
  address?: string;
  phone?: string;
  gstNumber?: string;
}

export interface KotPrint {
  kotNumber?: string;
  table: string;
  station: string;
  items: { name: string; qty: number; notes?: string }[];
  notes?: string;
  duration?: number;
  created: string;
  orderNumber?: string;
  staff?: string;
}

export interface BillPrint {
  orderNumber?: string;
  invoiceNumber?: string;
  table: string;
  staff?: string;
  guest?: string;
  created: string;
  closedAt?: string;
  items: { name: string; price: number; qty: number; isVoided?: boolean }[];
  discountAmount: number;
  discountReason?: string;
  taxPercent: number;
  shishaAdvance?: number;
  payments: { amount: number; method: string }[];
  booking?: { venue: string; rate: number; hours: number; advance: number } | null;
}

export interface ZReportPrint {
  shiftNumber: string;
  openedBy: string;
  closedBy?: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  totalSales: number;
  totalCash: number;
  totalUpi: number;
  totalCard: number;
  totalCredit: number;
  totalDiscount: number;
  totalTax: number;
  ordersCount: number;
  cashDrops: { amount: number; reason: string }[];
  expectedCash?: number;
  closingCashActual?: number;
  cashDifference?: number;
}

const STATION_LABEL: Record<string, string> = { Kitchen: 'KITCHEN', 'Beverage Counter': 'BAR', 'Shisha Master': 'SHISHA' };

/** KOT copies: the station's own copy, the waiter's copy, and the office record */
export type KotCopy = 'STATION' | 'STAFF' | 'ADMIN';

function copyBanner(copy: KotCopy | undefined, station: string, reprint?: boolean): string {
  if (!copy) return '';
  const label = copy === 'STATION' ? `${station} COPY` : `${copy} COPY`;
  return `<div class="c b s copy" data-copy="${copy}">— ${esc(label)}${reprint ? ' · REPRINT' : ''} —</div>`;
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function when(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

const STYLE = `
@page { size: 80mm auto; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font: 13px/1.35 'Courier New', Courier, monospace; }
.slip { width: 72mm; margin: 0 auto; padding: 3mm 0 6mm; page-break-after: always; break-after: page; }
.slip:last-child { page-break-after: auto; break-after: auto; }
.c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
.s { font-size: 11px; } .l { font-size: 17px; font-weight: 700; } .xl { font-size: 24px; font-weight: 800; line-height: 1.15; }
.inv { display: inline-block; background: #000; color: #fff; padding: 1px 8px; }
hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
.qty { width: 9mm; font-weight: 700; } .amt { width: 22mm; text-align: right; white-space: nowrap; }
.note { padding-left: 9mm; font-size: 12px; }
.strike { text-decoration: line-through; }
.tot td { font-size: 17px; font-weight: 800; padding-top: 3px; }
`;

/** Wraps one or more slips in a printable document (each slip on its own cut). */
export function printDocument(slips: string[], title = 'Layali print'): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${slips.join('')}</body></html>`;
}

/** Kitchen/bar/shisha ticket: big table and station, no prices. */
export function kotSlip(kot: KotPrint, copy?: KotCopy, reprint?: boolean): string {
  const station = STATION_LABEL[kot.station] ?? kot.station.toUpperCase();
  const items = kot.items
    .map(
      (it) =>
        `<tr><td class="qty l">${esc(it.qty)}×</td><td class="l">${esc(it.name)}</td></tr>` +
        (it.notes ? `<tr><td></td><td class="note">» ${esc(it.notes)}</td></tr>` : '')
    )
    .join('');
  return `<div class="slip" data-kind="kot">
  ${copyBanner(copy, station, reprint)}
  <div class="c"><span class="inv l">${esc(station)}</span></div>
  <div class="c xl" style="margin-top:4px">${esc(kot.table)}</div>
  <div class="c s">${esc(kot.kotNumber ?? '')}${kot.orderNumber ? ` · ${esc(kot.orderNumber)}` : ''}</div>
  <div class="c s">${esc(when(kot.created))}${kot.staff ? ` · ${esc(kot.staff)}` : ''}</div>
  <hr><table>${items}</table><hr>
  ${kot.notes ? `<div class="b">Note: ${esc(kot.notes)}</div>` : ''}
  ${kot.station === 'Shisha Master' && kot.duration ? `<div class="b">Session: ${esc(kot.duration)} min</div>` : ''}
</div>`;
}

/** Server void dockets prefix names ("[VOID CANCEL] Chicken Burger") and notes ("REASON: …"); print them plainly. */
function plainVoidName(name: string): string {
  return name.replace(/^\[[^\]]*\]\s*/, '');
}
function plainReason(note?: string): string {
  return (note ?? '').replace(/^REASON:\s*/i, '');
}

/** Cancellation ticket for the kitchen after a void. */
export function cancelSlip(kot: KotPrint, copy?: KotCopy, reprint?: boolean): string {
  const station = STATION_LABEL[kot.station] ?? kot.station.toUpperCase();
  const items = kot.items
    .map(
      (it) =>
        `<tr><td class="qty l">${esc(it.qty)}×</td><td class="l strike">${esc(plainVoidName(it.name))}</td></tr>` +
        (it.notes ? `<tr><td></td><td class="note">Reason: ${esc(plainReason(it.notes))}</td></tr>` : '')
    )
    .join('');
  return `<div class="slip" data-kind="cancel">
  ${copyBanner(copy, station, reprint)}
  <div class="c"><span class="inv xl">CANCEL</span></div>
  <div class="c l" style="margin-top:4px">${esc(station)} · ${esc(kot.table)}</div>
  <div class="c s">${esc(kot.kotNumber ?? '')} · ${esc(when(kot.created))}</div>
  <hr><table>${items}</table><hr>
  <div class="b">DO NOT PREPARE</div>
</div>`;
}

/** Bill totals: same rules as the billing screen and the server (voids excluded, rounded total). */
export function billTotals(bill: BillPrint) {
  const lines = bill.items.filter((it) => !it.isVoided);
  const itemTotal = lines.reduce((s, it) => s + it.price * it.qty, 0);
  const roomCharge = bill.booking ? bill.booking.rate * bill.booking.hours : 0;
  const subtotal = itemTotal + roomCharge;
  const discount = Math.min(subtotal, Math.max(0, bill.discountAmount || 0));
  const taxable = subtotal - discount;
  const tax = (taxable * bill.taxPercent) / 100;
  const exact = taxable + tax;
  const grandTotal = Math.round(exact);
  const advances = (bill.shishaAdvance || 0) + (bill.booking?.advance || 0);
  const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
  return { lines, itemTotal, roomCharge, subtotal, discount, taxable, tax, roundOff: grandTotal - exact, grandTotal, advances, paid, balance: grandTotal - advances - paid };
}

/** Customer bill. Once settled (invoice number present) it is a tax invoice with payments. */
export function billSlip(bill: BillPrint, settings: PrintSettings): string {
  const t = billTotals(bill);
  const settled = !!bill.invoiceNumber;
  const halfRate = bill.taxPercent / 2;
  const rows = t.lines
    .map((it) => `<tr><td>${esc(it.name)}</td><td class="r" style="width:8mm">${esc(it.qty)}</td><td class="amt">${money(it.price * it.qty)}</td></tr>`)
    .join('');
  const row = (label: string, value: string, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="amt">${value}</td></tr>`;
  const payments = bill.payments.map((p) => row(esc(p.method), money(p.amount))).join('');

  return `<div class="slip" data-kind="bill">
  <div class="c l">${esc(settings.loungeName)}</div>
  ${settings.tagline ? `<div class="c s">${esc(settings.tagline)}</div>` : ''}
  ${settings.address ? `<div class="c s">${esc(settings.address)}</div>` : ''}
  ${settings.phone ? `<div class="c s">Ph: ${esc(settings.phone)}</div>` : ''}
  ${settings.gstNumber ? `<div class="c s">GSTIN: ${esc(settings.gstNumber)}</div>` : ''}
  <hr><div class="c b">${settled && settings.gstNumber ? 'TAX INVOICE' : settled ? 'RECEIPT' : 'BILL'}</div>
  <table>
    ${settled ? row('Invoice', esc(bill.invoiceNumber)) : ''}
    ${row('Date', esc(when(settled ? bill.closedAt : undefined)))}
    ${row('Table', esc(bill.table))}
    ${bill.orderNumber ? row('Order', esc(bill.orderNumber)) : ''}
    ${bill.staff ? row('Served by', esc(bill.staff)) : ''}
    ${bill.guest ? row('Guest', esc(bill.guest)) : ''}
  </table>
  <hr><table><tr class="b"><td>Item</td><td class="r">Qty</td><td class="amt">Amount</td></tr>${rows}
  ${bill.booking ? `<tr><td>${esc(bill.booking.venue)} (${esc(bill.booking.hours)} h × ${money(bill.booking.rate)})</td><td></td><td class="amt">${money(t.roomCharge)}</td></tr>` : ''}
  </table><hr>
  <table>
    ${row('Subtotal', money(t.subtotal))}
    ${t.discount > 0 ? row(`Discount${bill.discountReason ? ` (${esc(bill.discountReason)})` : ''}`, '-' + money(t.discount)) : ''}
    ${bill.taxPercent > 0 ? row(`CGST ${halfRate}%`, money(t.tax / 2)) + row(`SGST ${halfRate}%`, money(t.tax / 2)) : ''}
    ${Math.abs(t.roundOff) >= 0.005 ? row('Round off', (t.roundOff > 0 ? '+' : '-') + money(Math.abs(t.roundOff))) : ''}
    ${row('TOTAL ₹', money(t.grandTotal), 'tot')}
  </table>
  ${t.advances > 0 ? `<table>${row('Advance paid', '-' + money(t.advances))}</table>` : ''}
  ${settled ? `<hr><table>${payments}</table>` : `<hr><table>${row('<b>Amount due ₹</b>', `<b>${money(Math.max(0, t.grandTotal - t.advances - t.paid))}</b>`)}</table>`}
  <hr><div class="c">Thank you! Visit again.</div>
</div>`;
}

/** Day-end / shift close report for the cash drawer. */
export function zReportSlip(z: ZReportPrint, settings: PrintSettings): string {
  const row = (label: string, value: string, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="amt">${value}</td></tr>`;
  const drops = z.cashDrops.reduce((s, d) => s + d.amount, 0);
  const diff = z.cashDifference ?? 0;
  return `<div class="slip" data-kind="zreport">
  <div class="c l">${esc(settings.loungeName)}</div>
  <div class="c b">SHIFT CLOSE · Z-REPORT</div>
  <div class="c s">${esc(z.shiftNumber)}</div><hr>
  <table>
    ${row('Opened', esc(when(z.openedAt)))}
    ${row('Opened by', esc(z.openedBy))}
    ${row('Closed', esc(when(z.closedAt)))}
    ${z.closedBy ? row('Closed by', esc(z.closedBy)) : ''}
  </table><hr>
  <table>
    ${row('Bills settled', esc(z.ordersCount))}
    ${row('Sales (items)', money(z.totalSales))}
    ${row('Discounts', (z.totalDiscount > 0 ? '-' : '') + money(z.totalDiscount))}
    ${row('GST collected', money(z.totalTax))}
  </table><hr>
  <table>
    ${row('Cash', money(z.totalCash))}
    ${row('UPI', money(z.totalUpi))}
    ${row('Card', money(z.totalCard))}
    ${row('Credit (Khata)', money(z.totalCredit))}
  </table><hr>
  <div class="b">Cash drawer</div>
  <table>
    ${row('Opening float', money(z.openingFloat))}
    ${row('+ Cash sales', money(z.totalCash))}
    ${row('- Cash drops', money(drops))}
    ${row('Expected', money(z.expectedCash ?? z.openingFloat + z.totalCash - drops), 'b')}
    ${z.closingCashActual !== undefined ? row('Counted', money(z.closingCashActual), 'b') : ''}
    ${z.closingCashActual !== undefined ? row(diff === 0 ? 'Difference' : diff > 0 ? 'Over' : 'Short', money(Math.abs(diff)), 'tot') : ''}
  </table>
  ${z.cashDrops.length ? `<hr><div class="b">Cash drops</div><table>${z.cashDrops.map((d) => row(esc(d.reason || 'Drop'), money(d.amount))).join('')}</table>` : ''}
  <hr><div class="c s">Signature ____________________</div>
</div>`;
}
