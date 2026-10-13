export type Station = 'Kitchen' | 'Beverage Counter' | 'Shisha Master';

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'CAPTAIN' | 'KITCHEN_CHEF' | 'SHISHA_MASTER';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  phone?: string;
}

export type KOTStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  station: Station;
  category: string;
  isAvailable: boolean;
  prepTimeMin?: number;
}

export interface CartItem extends MenuItem {
  qty: number;
  notes?: string;
}

export interface TableInfo {
  id: string;
  name: string;
  floor: string;
  type: 'regular' | 'private';
  capacity: number;
  status?: 'VACANT' | 'OCCUPIED' | 'BILL_PRINTED' | 'RESERVED';
  currentOrderId?: string | null;
  hourlyRate?: number;
  isLocked?: boolean;
}

export interface PrivateBooking {
  id: string;
  bookingNumber?: string;
  venue: 'VIP Lounge' | 'Couple Cabin';
  guest: string;
  phone: string;
  rate: number;
  advance: number;
  hours: number;
  start: string;
  end?: string;
  status: 'ACTIVE' | 'CLOSED';
  notes?: string;
}

export interface PaymentEntry {
  id?: string;
  amount: number;
  method: 'Cash' | 'UPI' | 'Card' | 'Credit Account';
  creditRef?: string;
  timestamp: string;
}

export interface OrderItem {
  name: string;
  price: number;
  station: Station;
  category: string;
  qty: number;
  notes?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
}

export interface TableTransferRecord {
  fromTable: string;
  toTable: string;
  timestamp: string;
  staff: string;
}

export interface Order {
  id: string;
  orderNumber?: string;
  /** GST invoice serial, set when the bill is settled */
  invoiceNumber?: string;
  closedAt?: string;
  location: string;
  guest: string;
  phone: string;
  staff: string;
  bookingId: string | null;
  shiftId?: string;
  items: OrderItem[];
  notes: string;
  shishaAdvance: number;
  duration: number; // minutes for shisha if any
  created: string;
  payments: PaymentEntry[];
  tableTransferHistory?: TableTransferRecord[];
  closed: boolean;
  taxPercent: number;
  discountType?: 'percentage' | 'flat';
  discountPercent?: number;
  discountAmount: number;
  discountReason?: string;
}

export interface KOT {
  id: string;
  kotNumber?: string;
  orderId: string;
  orderNumber?: string;
  location: string;
  guest: string;
  station: Station;
  items: { name: string; price: number; qty: number; notes?: string }[];
  notes: string;
  duration?: number;
  status: KOTStatus;
  created: string;
  startedAt?: string;
  readyAt?: string;
  servedAt?: string;
}

export interface AppSettings {
  loungeName: string;
  tagline: string;
  address: string;
  phone: string;
  gstNumber: string;
  taxPercent: number;
  soundAlerts: boolean;
  shishaDefaultDuration: number;
  upiId?: string;
}

/** Private room charge as printed on the bill */
export interface BillBooking {
  venue: string;
  rate: number;
  hours: number;
  advance: number;
}

export interface CashDrop {
  amount: number;
  reason: string;
  staff: string;
  timestamp: string;
}

export interface ShiftRegister {
  id?: string;
  shiftNumber: string;
  openedBy: string;
  openingFloat: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  closedBy?: string;
  closingCashActual?: number;
  expectedCash?: number;
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
  notes?: string;
}
