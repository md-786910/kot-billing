export type Station = 'Kitchen' | 'Beverage Counter' | 'Shisha Master';
export type TableStatus = 'VACANT' | 'OCCUPIED' | 'BILL_PRINTED' | 'RESERVED';
export type KOTStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'CAPTAIN' | 'KITCHEN_CHEF' | 'SHISHA_MASTER';

export interface StaffUser {
  id: string;
  name: string;
  role: UserRole;
  phone?: string;
  pin?: string;
}

export interface TableItem {
  id: string;
  name: string;
  floor: string;
  type: 'regular' | 'private';
  capacity: number;
  status: TableStatus;
  currentOrderId?: string | null;
  hourlyRate?: number;
}

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
  reason?: string;
}

export interface Order {
  id: string;
  orderNumber?: string;
  tableName: string;
  guestName?: string;
  guestPhone?: string;
  staffName?: string;
  items: OrderItem[];
  notes?: string;
  shishaAdvance?: number;
  duration?: number;
  closed: boolean;
  taxPercent: number;
  discountAmount: number;
  tableTransferHistory?: TableTransferRecord[];
  createdAt: string;
}

export interface KOT {
  id: string;
  kotNumber?: string;
  orderNumber?: string;
  tableName: string;
  guestName?: string;
  station: Station;
  items: { name: string; price: number; qty: number; notes?: string }[];
  notes?: string;
  duration?: number;
  status: KOTStatus;
  createdAt: string;
}
