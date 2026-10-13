import { MenuItemModel } from '@/models/MenuItem';
import { KOTModel } from '@/models/KOT';
import { OrderModel } from '@/models/Order';
import { maxSuffix, nextSequence } from '@/lib/counters';

export const STATIONS = ['Kitchen', 'Beverage Counter', 'Shisha Master'] as const;
type Station = (typeof STATIONS)[number];

export interface PricedItem {
  name: string;
  price: number;
  station: Station;
  category: string;
  qty: number;
  notes: string;
}

/**
 * Turns the client's cart into order lines priced from the menu.
 * Only name, qty and notes are taken from the client; unknown or out-of-stock items are refused.
 */
export async function priceItems(raw: unknown): Promise<{ items: PricedItem[] } | { error: string; status: number }> {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Add at least one item', status: 400 };
  if (raw.length > 100) return { error: 'Too many items in one order', status: 400 };

  const lines: { name: string; qty: number; notes: string }[] = [];
  for (const it of raw) {
    const name = typeof it?.name === 'string' ? it.name.trim() : '';
    const qty = Number(it?.qty);
    if (!name || !Number.isInteger(qty) || qty < 1 || qty > 99) return { error: 'Each item needs a name and a quantity of 1–99', status: 400 };
    const notes = typeof it?.notes === 'string' ? it.notes.trim().slice(0, 200) : '';
    lines.push({ name, qty, notes });
  }

  const menu = await MenuItemModel.find({ name: { $in: [...new Set(lines.map((l) => l.name))] } }).lean();
  const byName = new Map(menu.map((m) => [m.name, m]));
  const items: PricedItem[] = [];
  for (const line of lines) {
    const m = byName.get(line.name);
    if (!m) return { error: `${line.name} is not on the menu`, status: 400 };
    if (!m.isAvailable) return { error: `${line.name} is out of stock`, status: 409 };
    items.push({ name: m.name, price: m.price, station: m.station as Station, category: m.category, qty: line.qty, notes: line.notes });
  }
  return { items };
}

export async function nextOrderNumber(): Promise<string> {
  const seq = await nextSequence('order', async () => {
    const orders = await OrderModel.find({ orderNumber: /^LY-/ }).select('orderNumber').lean();
    return maxSuffix(orders.map((o) => o.orderNumber), 'LY-', 1000);
  });
  return `LY-${seq}`;
}

export async function nextKotNumber(prefix: 'KOT' | 'VOID'): Promise<string> {
  const seq = await nextSequence(prefix.toLowerCase(), async () => {
    const kots = await KOTModel.find({ kotNumber: new RegExp(`^${prefix}-`) }).select('kotNumber').lean();
    return maxSuffix(kots.map((k) => k.kotNumber), `${prefix}-`);
  });
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/** One NEW ticket per station for the given lines. */
export async function createStationKots(
  order: { _id: unknown; orderNumber: string; tableName: string; guestName?: string },
  items: PricedItem[],
  notes: string,
  shishaDuration?: number
) {
  const kots = [];
  for (const station of STATIONS) {
    const stationItems = items.filter((it) => it.station === station);
    if (stationItems.length === 0) continue;
    const kot = await KOTModel.create({
      kotNumber: await nextKotNumber('KOT'),
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      tableName: order.tableName,
      guestName: order.guestName,
      station,
      items: stationItems.map((it) => ({ name: it.name, price: it.price, qty: it.qty, notes: it.notes })),
      notes,
      duration: station === 'Shisha Master' ? shishaDuration : undefined,
      status: 'NEW',
    });
    kots.push(kot.toObject());
  }
  return kots;
}

export function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number })?.code === 11000;
}

/** Indian financial year label (April–March), e.g. "2026-27" */
export function financialYear(date = new Date()): string {
  const y = date.getFullYear();
  const start = date.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** GST invoice serial: consecutive within the financial year, e.g. "2026-27/0012" */
export async function nextInvoiceNumber(): Promise<string> {
  const fy = financialYear();
  const seq = await nextSequence(`invoice-${fy}`, async () => {
    const last = await OrderModel.find({ invoiceNumber: new RegExp(`^${fy}/`) }).select('invoiceNumber').lean();
    return maxSuffix(last.map((o) => o.invoiceNumber ?? ''), `${fy}/`);
  });
  return `${fy}/${String(seq).padStart(4, '0')}`;
}
