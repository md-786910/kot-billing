export type Station = 'Kitchen' | 'Beverage Counter' | 'Shisha Master';
export type TableStatus = 'VACANT' | 'OCCUPIED' | 'BILL_PRINTED' | 'RESERVED';
export type KOTStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'CAPTAIN' | 'KITCHEN_CHEF' | 'SHISHA_MASTER';

export type DeviceType = 'TERMINAL' | 'MOBILE' | 'DISPLAY';

/** Server-side permission keys (see web/src/lib/auth/permissions.ts) */
export type Permission =
  | 'data.read'
  | 'order.create'
  | 'table.move'
  | 'order.void'
  | 'bill.settle'
  | 'bill.discount.unlimited'
  | 'kot.update'
  | 'shisha.manage'
  | 'booking.manage'
  | 'shift.manage'
  | 'menu.stock'
  | 'menu.edit'
  | 'table.update'
  | 'staff.manage'
  | 'device.manage'
  | 'settings.manage'
  | 'audit.view';

/** A staff member as returned by /auth/staff and /auth/me (never includes PINs) */
export interface StaffUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuthDevice {
  id: string;
  name: string;
  type: DeviceType;
  station: Station | null;
}

export interface AuthState {
  setupRequired: boolean;
  user: StaffUser | null;
  device: AuthDevice | null;
  permissions: Permission[];
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
  /** When the ticket/pot was started (shisha timer restarts on a head change) */
  startedAt?: string;
}
