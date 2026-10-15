import { TableItem, MenuItem, Order, KOT, StaffUser, AuthDevice, AuthState } from '../types';

// ---------- Client state ----------

/** The production server every phone talks to */
export const SERVER_URL = 'https://kot-billing.vercel.app';

let deviceToken: string | null = null;
let sessionToken: string | null = null;
let unauthorizedHandler: ((sessionTokenUsed: string | null) => void) | null = null;

const REQUEST_TIMEOUT_MS = 10_000;
/** Order punches and settlements can take longer (KOT printing, several writes) */
export const SLOW_REQUEST_TIMEOUT_MS = 25_000;

/** Random key so a retried submission is applied at most once by the server (max 100 chars) */
export function newIdempotencyKey(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `m-${Date.now().toString(36)}-${random()}${random()}${random()}`;
}

/** The server's reply when the same idempotencyKey is still being processed */
export function isStillProcessing(status: number | undefined, message: string | undefined): boolean {
  return status === 409 && /already being processed/i.test(message ?? '');
}

export function setDeviceToken(token: string | null) {
  deviceToken = token;
}

export function getDeviceToken() {
  return deviceToken;
}

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

export function getSessionToken() {
  return sessionToken;
}

/**
 * Called when a normal API call returns 401 (session ended or device revoked).
 * Receives the session token that request was sent with, so stale in-flight calls can be ignored.
 */
export function setOnUnauthorized(handler: ((sessionTokenUsed: string | null) => void) | null) {
  unauthorizedHandler = handler;
}

// ---------- Request helper ----------

/** Every failed call throws this. `status` is 0 for network errors and timeouts. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  sessionToken?: string;
  deviceToken?: string;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Sign-in style calls where 401 means "wrong code/PIN", not "session ended" */
  skipUnauthorizedHook?: boolean;
  /** Override the session token sent (e.g. to revoke a session that was already cleared locally) */
  sessionTokenOverride?: string | null;
  timeoutMs?: number;
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { method = 'GET', body, skipUnauthorizedHook = false, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  // Device token and session are read before the first await: callers rely on this to
  // send a last request with them just before clearing them.
  const tokenUsed = options.sessionTokenOverride !== undefined ? options.sessionTokenOverride : sessionToken;

  const headers: Record<string, string> = { 'X-Client': 'mobile', Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (deviceToken) headers['X-Device-Token'] = deviceToken;
  if (tokenUsed) headers.Authorization = `Bearer ${tokenUsed}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError(0, 'The server did not respond. Check the internet connection.');
    }
    throw new ApiError(0, 'Cannot reach the server. Check the internet connection.');
  } finally {
    clearTimeout(timer);
  }

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    json = null;
  }

  if (!res.ok || !json || json.success === false) {
    const message = json?.error || json?.message || `Server error (${res.status})`;
    if (res.status === 401 && !skipUnauthorizedHook) unauthorizedHandler?.(tokenUsed ?? null);
    throw new ApiError(res.ok ? 500 : res.status, message);
  }
  return json;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function errorStatus(err: unknown): number {
  return err instanceof ApiError ? err.status : 0;
}

/** Server data version; it changes whenever any device changes orders, KOTs, tables or bookings */
export async function fetchSyncVersion(): Promise<number> {
  const json = await request<{ version: number }>('/api/v1/sync');
  return json.data?.version ?? 0;
}

// ---------- Auth & devices ----------

export async function fetchAuthMe(): Promise<AuthState> {
  const json = await request<AuthState>('/api/v1/auth/me', { skipUnauthorizedHook: true });
  const data = json.data;
  return {
    setupRequired: !!data?.setupRequired,
    user: data?.user ?? null,
    device: data?.device ?? null,
    permissions: data?.permissions ?? [],
  };
}

export async function pairDevice(code: string): Promise<{ device: AuthDevice; deviceToken: string }> {
  const json = await request<AuthDevice>('/api/v1/devices/pair', {
    method: 'POST',
    body: { code },
    skipUnauthorizedHook: true,
  });
  if (!json.data || !json.deviceToken) throw new ApiError(500, 'Pairing failed: the server did not return a device token');
  return { device: json.data, deviceToken: json.deviceToken };
}

export async function unpairDevice(timeoutMs?: number): Promise<void> {
  await request('/api/v1/devices/pair', { method: 'DELETE', skipUnauthorizedHook: true, timeoutMs });
}

/** Names for the lock screen picker (needs a paired device) */
export async function fetchSignInStaff(): Promise<StaffUser[]> {
  const json = await request<StaffUser[]>('/api/v1/auth/staff', { skipUnauthorizedHook: true });
  return (json.data ?? []).map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

export async function signInWithPin(userId: string, pin: string): Promise<{ user: StaffUser; sessionToken: string }> {
  const json = await request<{ user: StaffUser }>('/api/v1/auth/pin', {
    method: 'POST',
    body: { userId, pin },
    skipUnauthorizedHook: true,
    sessionTokenOverride: null,
  });
  if (!json.data?.user || !json.sessionToken) throw new ApiError(500, 'Sign in failed: no session returned');
  return { user: json.data.user, sessionToken: json.sessionToken };
}

/** Revokes a session on the server. Pass the token explicitly: it is usually cleared locally first. */
export async function logoutSession(token: string): Promise<void> {
  await request('/api/v1/auth/logout', { method: 'POST', skipUnauthorizedHook: true, sessionTokenOverride: token });
}

export async function changeOwnPin(currentPin: string, newPin: string): Promise<void> {
  // 401 here means "current PIN is incorrect", so don't treat it as a lost session
  await request('/api/v1/auth/change-pin', {
    method: 'POST',
    body: { currentPin, newPin },
    skipUnauthorizedHook: true,
  });
}

export async function pingServer(): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  try {
    await request('/api/v1/auth/me', { skipUnauthorizedHook: true, timeoutMs: 5_000 });
    return { success: true, latencyMs: Date.now() - start, message: 'Connected' };
  } catch (err) {
    return { success: false, latencyMs: Date.now() - start, message: errorMessage(err, 'Connection failed') };
  }
}

// ---------- Data ----------

export async function fetchTables(): Promise<TableItem[]> {
  const json = await request<any[]>('/api/v1/tables');
  return (json.data ?? []).map((t: any) => ({
    id: t._id || t.name,
    name: t.name,
    floor: t.floor,
    type: t.type,
    capacity: t.capacity,
    status: t.status,
    currentOrderId: t.currentOrderId,
    hourlyRate: t.hourlyRate,
  }));
}

export async function fetchMenu(): Promise<MenuItem[]> {
  const json = await request<any[]>('/api/v1/menu');
  return (json.data ?? []).map((m: any) => ({
    id: m._id || m.id,
    name: m.name,
    price: m.price,
    station: m.station,
    category: m.category,
    isAvailable: m.isAvailable,
    prepTimeMin: m.prepTimeMin,
  }));
}

export async function fetchOrders(): Promise<Order[]> {
  const json = await request<any[]>('/api/v1/orders?status=open');
  return (json.data ?? []).map((o: any) => ({
    id: o._id || o.orderNumber,
    orderNumber: o.orderNumber,
    tableName: o.tableName,
    guestName: o.guestName,
    guestPhone: o.guestPhone,
    staffName: o.staffName,
    items: o.items || [],
    notes: o.notes,
    shishaAdvance: o.shishaAdvance,
    duration: o.duration,
    closed: o.closed,
    taxPercent: o.taxPercent,
    discountAmount: o.discountAmount,
    createdAt: o.createdAt,
  }));
}

export async function fetchKOTs(): Promise<KOT[]> {
  const json = await request<any[]>('/api/v1/kots?status=RECENT');
  return (json.data ?? []).map((k: any) => ({
    id: k._id || k.kotNumber,
    kotNumber: k.kotNumber,
    orderNumber: k.orderNumber,
    tableName: k.tableName,
    guestName: k.guestName,
    station: k.station,
    items: k.items || [],
    notes: k.notes,
    duration: k.duration,
    status: k.status,
    createdAt: k.createdAt,
    startedAt: k.startedAt,
  }));
}

// ---------- Actions (all throw ApiError on failure) ----------

type OrderLine = { name: string; price: number; station: string; category: string; qty: number; notes?: string };

/** The server records the signed-in staff member on the order. Reuse `idempotencyKey` when retrying. */
export function submitMobileOrder(params: {
  tableName: string;
  guestName?: string;
  guestPhone?: string;
  items: OrderLine[];
  notes?: string;
  shishaAdvance?: number;
  duration?: number;
  idempotencyKey: string;
}) {
  return request('/api/v1/orders', { method: 'POST', body: params, timeoutMs: SLOW_REQUEST_TIMEOUT_MS });
}

export function addItemsToRunningOrder(params: {
  orderId: string;
  newItems: OrderLine[];
  notes?: string;
  idempotencyKey: string;
}) {
  return request('/api/v1/orders', { method: 'PATCH', body: params, timeoutMs: SLOW_REQUEST_TIMEOUT_MS });
}

export function extendShishaPot(kotId: string, addMinutes: number = 15) {
  return request('/api/v1/shisha', { method: 'POST', body: { kotId, addMinutes } });
}

export function transferTableOrder(params: { orderId: string; fromTable: string; toTable: string; reason?: string }) {
  return request('/api/v1/orders/transfer', { method: 'POST', body: params });
}

/** `pin` is a manager's approval PIN, only needed when the signed-in user lacks `order.void` */
export function voidOrderItem(params: { orderId: string; itemIndex: number; voidReason: string; pin?: string }) {
  return request('/api/v1/orders/void', { method: 'POST', body: params });
}

export function voidWholeOrder(params: { orderId: string; table: string; voidReason: string; pin?: string }) {
  return request('/api/v1/orders/void', { method: 'POST', body: { ...params, voidEntireOrder: true } });
}

export function updateKOTStatus(kotId: string, status: string) {
  return request('/api/v1/kots', { method: 'PATCH', body: { kotId, status } });
}

export interface PaymentLine {
  amount: number;
  method: string;
  creditRef?: string;
}

/** `approvalPin` is a manager's PIN for discounts above the cashier limit. Reuse `idempotencyKey` when retrying. */
export function settleOrderBill(params: {
  orderId: string;
  payment?: PaymentLine;
  payments?: PaymentLine[];
  discount?: number;
  discountType?: string;
  discountReason?: string;
  taxPercent?: number;
  closeOrder?: boolean;
  approvalPin?: string;
  idempotencyKey: string;
}) {
  return request('/api/v1/billing', { method: 'POST', body: params, timeoutMs: SLOW_REQUEST_TIMEOUT_MS });
}

export function mergeTableOrders(params: { sourceTable: string; targetTable: string }) {
  return request('/api/v1/orders/merge', { method: 'POST', body: params });
}

export function toggleMenuItemAvailability(id: string, isAvailable: boolean) {
  return request('/api/v1/menu', { method: 'PATCH', body: { id, isAvailable } });
}

export function fetchShiftSummary() {
  return request('/api/v1/shifts');
}
