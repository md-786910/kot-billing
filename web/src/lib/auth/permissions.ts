import type { UserRole } from '@/models/User';
import type { DeviceStation } from '@/models/Device';

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

const ALL: Permission[] = [
  'data.read', 'order.create', 'table.move', 'order.void', 'bill.settle', 'bill.discount.unlimited',
  'kot.update', 'shisha.manage', 'booking.manage', 'shift.manage', 'menu.stock', 'menu.edit',
  'table.update', 'staff.manage', 'device.manage', 'settings.manage', 'audit.view',
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: ALL,
  MANAGER: ALL.filter((p) => !['staff.manage', 'device.manage', 'settings.manage', 'menu.edit'].includes(p)),
  CASHIER: ['data.read', 'order.create', 'table.move', 'bill.settle', 'booking.manage', 'shift.manage', 'shisha.manage'],
  CAPTAIN: ['data.read', 'order.create', 'table.move', 'kot.update', 'shisha.manage'],
  KITCHEN_CHEF: ['data.read', 'kot.update'],
  SHISHA_MASTER: ['data.read', 'kot.update', 'shisha.manage'],
};

// Station displays run on their device token alone, without a staff sign-in
export function displayPermissions(station?: DeviceStation | null): Permission[] {
  const perms: Permission[] = ['data.read', 'kot.update'];
  if (station === 'Shisha Master') perms.push('shisha.manage');
  return perms;
}

// Actions a staff member without the permission can still do with a manager's PIN
export const OVERRIDABLE: Permission[] = ['order.void', 'bill.discount.unlimited'];

// Discount a cashier may give without manager approval, as % of the bill subtotal
export const CASHIER_DISCOUNT_LIMIT_PERCENT = 10;

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Owner / Admin',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  CAPTAIN: 'Captain',
  KITCHEN_CHEF: 'Kitchen',
  SHISHA_MASTER: 'Shisha Master',
};
