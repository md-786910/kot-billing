import { TableItem, MenuItem, Order, KOT } from '../types';

let serverUrl = 'http://localhost:3001';

export function setServerBaseUrl(url: string) {
  serverUrl = url.replace(/\/+$/, '');
}

export function getServerBaseUrl() {
  return serverUrl;
}

export async function checkServerHealth(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${serverUrl}/api/v1/init`, { method: 'GET' });
    const data = await res.json();
    return { success: data.success, message: data.message || 'Connected' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}

export async function fetchTables(): Promise<TableItem[]> {
  const res = await fetch(`${serverUrl}/api/v1/tables`);
  const json = await res.json();
  if (json.success && json.data) {
    return json.data.map((t: any) => ({
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
  return [];
}

export async function fetchMenu(): Promise<MenuItem[]> {
  const res = await fetch(`${serverUrl}/api/v1/menu`);
  const json = await res.json();
  if (json.success && json.data) {
    return json.data.map((m: any) => ({
      id: m._id || m.id,
      name: m.name,
      price: m.price,
      station: m.station,
      category: m.category,
      isAvailable: m.isAvailable,
      prepTimeMin: m.prepTimeMin,
    }));
  }
  return [];
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${serverUrl}/api/v1/orders?status=open`);
  const json = await res.json();
  if (json.success && json.data) {
    return json.data.map((o: any) => ({
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
  return [];
}

export async function fetchKOTs(): Promise<KOT[]> {
  const res = await fetch(`${serverUrl}/api/v1/kots?status=ACTIVE_ALL`);
  const json = await res.json();
  if (json.success && json.data) {
    return json.data.map((k: any) => ({
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
    }));
  }
  return [];
}

export async function submitMobileOrder(params: {
  tableName: string;
  guestName?: string;
  guestPhone?: string;
  staffName?: string;
  items: { name: string; price: number; station: string; category: string; qty: number; notes?: string }[];
  notes?: string;
  shishaAdvance?: number;
  duration?: number;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${serverUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    return json;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function addItemsToRunningOrder(params: {
  orderId: string;
  newItems: { name: string; price: number; station: string; category: string; qty: number; notes?: string }[];
  notes?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${serverUrl}/api/v1/orders`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    return json;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function extendShishaPot(kotId: string, addMinutes: number = 15) {
  const res = await fetch(`${serverUrl}/api/v1/shisha`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kotId, addMinutes }),
  });
  return res.json();
}

export async function transferTableOrder(params: {
  orderId: string;
  fromTable: string;
  toTable: string;
  staff?: string;
  reason?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${serverUrl}/api/v1/orders/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function voidOrderItem(params: {
  orderId: string;
  itemIndex: number;
  voidReason: string;
  pin?: string;
  staff?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${serverUrl}/api/v1/orders/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function updateKOTStatus(
  kotId: string,
  status: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${serverUrl}/api/v1/kots`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: kotId, status }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}
