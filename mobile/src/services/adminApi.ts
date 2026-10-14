import { request } from './api';
import { DeviceType, MenuItem, Station, UserRole } from '../types';

/**
 * Admin screens (menu, lounge settings, staff, devices). Every call throws ApiError on failure,
 * carrying the server's message (e.g. validation errors), so screens can show it as is.
 */

// ---------- Menu ----------

export async function fetchAdminMenu(): Promise<MenuItem[]> {
  const json = await request<any[]>('/api/v1/menu');
  return (json.data ?? []).map((m: any) => ({
    id: String(m._id || m.id || m.name),
    name: m.name,
    price: Number(m.price) || 0,
    station: m.station,
    category: m.category,
    isAvailable: m.isAvailable !== false,
    prepTimeMin: m.prepTimeMin,
  }));
}

/** Needs `menu.edit` */
export async function createMenuItem(input: { name: string; price: number; station: Station; category: string }): Promise<void> {
  await request('/api/v1/menu', { method: 'POST', body: input });
}

/** Needs `menu.edit` */
export async function updateMenuItemPrice(id: string, price: number): Promise<void> {
  await request('/api/v1/menu', { method: 'PATCH', body: { id, price } });
}

/** Needs `menu.stock` */
export async function setMenuItemAvailable(id: string, isAvailable: boolean): Promise<void> {
  await request('/api/v1/menu', { method: 'PATCH', body: { id, isAvailable } });
}

// ---------- Lounge settings ----------

export interface LoungeSettings {
  loungeName: string;
  tagline: string;
  address: string;
  phone: string;
  gstNumber: string;
  taxPercent: number;
  soundAlerts: boolean;
  shishaDefaultDuration: number;
  upiId: string;
  /** Extra KOT copies besides the station copy */
  kotStaffCopy: boolean;
  kotAdminCopy: boolean;
}

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export async function fetchSettings(): Promise<LoungeSettings> {
  const json = await request<LoungeSettings>('/api/v1/settings');
  const d: Partial<LoungeSettings> = json.data ?? {};
  return {
    loungeName: d.loungeName ?? '',
    tagline: d.tagline ?? '',
    address: d.address ?? '',
    phone: d.phone ?? '',
    gstNumber: d.gstNumber ?? '',
    taxPercent: Number(d.taxPercent ?? 5),
    soundAlerts: d.soundAlerts !== false,
    shishaDefaultDuration: Number(d.shishaDefaultDuration ?? 45),
    upiId: d.upiId ?? '',
    kotStaffCopy: d.kotStaffCopy ?? true,
    kotAdminCopy: d.kotAdminCopy ?? true,
  };
}

/** Needs `settings.manage`. The server validates GSTIN, GST rate and shisha minutes. */
export async function saveSettings(update: Partial<LoungeSettings>): Promise<void> {
  await request('/api/v1/settings', { method: 'PATCH', body: update });
}

// ---------- Staff ----------

/** A staff member as listed for admins. PINs and passwords are never returned. */
export interface StaffMember {
  id: string;
  name: string;
  role: UserRole;
  phone: string;
  username: string;
  hasPassword: boolean;
  isActive: boolean;
  isLocked: boolean;
}

export async function fetchStaff(): Promise<StaffMember[]> {
  const json = await request<StaffMember[]>('/api/v1/staff');
  return (json.data ?? []).map((u) => ({
    id: String(u.id),
    name: u.name,
    role: u.role,
    phone: u.phone ?? '',
    username: u.username ?? '',
    hasPassword: !!u.hasPassword,
    isActive: u.isActive !== false,
    isLocked: !!u.isLocked,
  }));
}

export async function createStaff(input: {
  name: string;
  role: UserRole;
  phone: string;
  pin: string;
  username?: string;
  password?: string;
}): Promise<void> {
  await request('/api/v1/staff', { method: 'POST', body: input });
}

export async function updateStaff(
  id: string,
  changes: {
    name?: string;
    role?: UserRole;
    phone?: string;
    pin?: string;
    username?: string;
    password?: string;
    isActive?: boolean;
    unlock?: boolean;
  }
): Promise<void> {
  await request('/api/v1/staff', { method: 'PATCH', body: { id, ...changes } });
}

// ---------- Devices ----------

export interface PairedDevice {
  id: string;
  name: string;
  type: DeviceType;
  lastSeenAt: string | null;
  pairedBy: string | null;
  printStation: boolean;
  /** The device making this request (this phone) */
  isCurrent: boolean;
}

export async function fetchDevices(): Promise<PairedDevice[]> {
  const json = await request<PairedDevice[]>('/api/v1/devices');
  return (json.data ?? []).map((d) => ({
    id: String(d.id),
    name: d.name,
    type: d.type,
    lastSeenAt: d.lastSeenAt ?? null,
    pairedBy: d.pairedBy ?? null,
    printStation: !!d.printStation,
    isCurrent: !!d.isCurrent,
  }));
}

/** One-time code (single use, expires in about 10 minutes) to pair another device */
export async function createPairingCode(input: { name: string; type: 'TERMINAL' | 'MOBILE' }): Promise<{ code: string; expiresAt: string }> {
  const json = await request<{ code: string; expiresAt: string }>('/api/v1/devices', {
    method: 'POST',
    body: { action: 'pairing-code', ...input },
  });
  if (!json.data?.code) throw new Error('The server did not return a pairing code');
  return { code: String(json.data.code), expiresAt: String(json.data.expiresAt) };
}

/** Counter computers only; clears the flag on every other device */
export async function setPrintStation(id: string): Promise<void> {
  await request('/api/v1/devices', { method: 'PATCH', body: { id, printStation: true } });
}

/** Signs out everyone on the device immediately */
export async function revokeDevice(id: string): Promise<void> {
  await request('/api/v1/devices', { method: 'PATCH', body: { id, revoke: true } });
}

export async function renameDevice(id: string, name: string): Promise<void> {
  await request('/api/v1/devices', { method: 'PATCH', body: { id, name } });
}
