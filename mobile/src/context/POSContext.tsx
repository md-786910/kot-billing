import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { TableItem, MenuItem, CartItem, Order, KOT, StaffUser, AuthDevice, Permission } from '../types';
import {
  ApiError,
  errorMessage,
  errorStatus,
  fetchAuthMe,
  fetchTables,
  fetchMenu,
  fetchOrders,
  fetchKOTs,
  submitMobileOrder,
  extendShishaPot,
  transferTableOrder,
  voidOrderItem,
  updateKOTStatus,
  pingServer,
  settleOrderBill,
  mergeTableOrders,
  voidWholeOrder,
  toggleMenuItemAvailability,
  pairDevice,
  unpairDevice,
  signInWithPin,
  logoutSession,
  changeOwnPin,
  normalizeServerUrl,
  getServerBaseUrl,
  setServerBaseUrl,
  getDeviceToken,
  setDeviceToken,
  getSessionToken,
  setSessionToken,
  setOnUnauthorized,
  PaymentLine,
} from '../services/api';
import { readAllStored, writeStored } from '../services/storage';

/** booting → (unpaired | locked) → ready. Data is only loaded while `ready`. */
export type AuthStatus = 'booting' | 'unpaired' | 'locked' | 'ready';

export interface ActionResult {
  success: boolean;
  error?: string;
  /** HTTP status of the failure (0 = network/timeout) */
  status?: number;
}

const IDLE_LOCK_MS = 2 * 60_000;
const IDLE_CHECK_MS = 5_000;
const POLL_MS = 10_000;
const DEFAULT_TABLE = 'Table 1';

interface PingStats {
  latencyMs: number;
  message: string;
  lastPing: string;
}

interface POSContextType {
  // Connectivity & Server
  isConnected: boolean;
  serverUrl: string;
  changeServerUrl: (url: string) => Promise<ActionResult>;
  loading: boolean;
  refreshData: () => Promise<void>;
  pingStats: PingStats | null;
  runPingTest: () => Promise<void>;

  // Device & staff session
  authStatus: AuthStatus;
  device: AuthDevice | null;
  currentStaff: StaffUser | null;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
  /** Why the app is on the pairing/lock screen (e.g. session ended, server unreachable) */
  authNotice: string | null;
  checkAuth: () => Promise<void>;
  pair: (serverUrl: string, code: string) => Promise<ActionResult>;
  signIn: (userId: string, pin: string) => Promise<ActionResult>;
  lock: (reason?: string) => void;
  unpair: () => Promise<ActionResult>;
  changePin: (currentPin: string, newPin: string) => Promise<ActionResult>;
  /** Resets the inactivity timer (called from the root touch handler) */
  markActivity: () => void;

  // Data
  tables: TableItem[];
  menu: MenuItem[];
  orders: Order[];
  kots: KOT[];
  categories: string[];
  activeOrder?: Order;

  // Active Floor & Table
  selectedFloor: string;
  setSelectedFloor: (floor: string) => void;
  selectedTable: string;
  setSelectedTable: (table: string) => void;

  // Cart
  cart: CartItem[];
  addToCart: (item: MenuItem) => void;
  updateCartQty: (id: string, delta: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  hasShishaInCart: boolean;

  // Actions
  punchKOT: (params: {
    guestName?: string;
    guestPhone?: string;
    notes?: string;
    shishaAdvance?: number;
    duration?: number;
  }) => Promise<ActionResult>;
  extendShisha: (kotId: string, minutes?: number) => Promise<ActionResult>;
  transferTable: (fromTable: string, toTable: string, reason?: string) => Promise<ActionResult>;
  voidItem: (orderId: string, itemIndex: number, voidReason: string, managerPin?: string) => Promise<ActionResult>;
  updateKOT: (kotId: string, status: string) => Promise<ActionResult>;
  settleBill: (params: {
    orderId: string;
    payment?: PaymentLine;
    payments?: PaymentLine[];
    discount?: number;
    discountReason?: string;
    taxPercent?: number;
    approvalPin?: string;
  }) => Promise<ActionResult>;
  mergeTables: (sourceTable: string, targetTable: string) => Promise<ActionResult>;
  voidOrder: (orderId: string, table: string, voidReason: string, managerPin?: string) => Promise<ActionResult>;
  toggle86: (itemId: string, isAvailable: boolean) => Promise<ActionResult>;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

function failure(err: unknown): ActionResult {
  return { success: false, error: errorMessage(err), status: errorStatus(err) };
}

async function persistSessionToken(token: string | null) {
  setSessionToken(token);
  await writeStored('sessionToken', token);
}

async function persistDeviceToken(token: string | null) {
  setDeviceToken(token);
  await writeStored('deviceToken', token);
}

const NOT_PAIRED_NOTICE = "This phone isn't paired with the server. Enter a new pairing code.";

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [serverUrl, setServerUrlState] = useState('');
  const [loading, setLoading] = useState(false);
  const [pingStats, setPingStats] = useState<PingStats | null>(null);

  // Auth
  const [authStatus, setAuthStatus] = useState<AuthStatus>('booting');
  const [device, setDevice] = useState<AuthDevice | null>(null);
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Restaurant Data
  const [tables, setTables] = useState<TableItem[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [kots, setKots] = useState<KOT[]>([]);

  const [selectedFloor, setSelectedFloor] = useState('All');
  const [selectedTable, setSelectedTable] = useState(DEFAULT_TABLE);
  const [cart, setCart] = useState<CartItem[]>([]);

  const authStatusRef = useRef<AuthStatus>('booting');
  authStatusRef.current = authStatus;
  const lastActivityRef = useRef(Date.now());
  // Bumped on every lock so responses from a previous session are dropped
  const sessionEpochRef = useRef(0);

  // ---------- Session helpers ----------

  const resetSessionState = useCallback(() => {
    sessionEpochRef.current += 1;
    setCurrentStaff(null);
    setPermissions([]);
    setCart([]);
    setTables([]);
    setMenu([]);
    setOrders([]);
    setKots([]);
    setSelectedTable(DEFAULT_TABLE);
    setSelectedFloor('All');
  }, []);

  /** Lock immediately on the phone, then revoke the session on the server in the background */
  const lock = useCallback(
    (reason?: string) => {
      const token = getSessionToken();
      resetSessionState();
      void persistSessionToken(null);
      if (token) logoutSession(token).catch(() => {});
      setAuthNotice(reason ?? null);
      setAuthStatus((s) => (s === 'ready' ? 'locked' : s));
    },
    [resetSessionState]
  );

  /** Ask the server who we are and route to pairing / lock / app */
  const checkAuth = useCallback(async () => {
    if (!getServerBaseUrl() || !getDeviceToken()) {
      setDevice(null);
      setAuthStatus('unpaired');
      return;
    }
    try {
      const me = await fetchAuthMe();
      setIsConnected(true);
      if (!me.device || me.device.type === 'DISPLAY') {
        // Revoked, or this token belongs to another server: start over with a new code
        await persistSessionToken(null);
        await persistDeviceToken(null);
        resetSessionState();
        setDevice(null);
        setAuthNotice(NOT_PAIRED_NOTICE);
        setAuthStatus('unpaired');
        return;
      }
      setDevice(me.device);
      if (me.user) {
        setCurrentStaff(me.user);
        setPermissions(me.permissions);
        lastActivityRef.current = Date.now();
        setAuthStatus('ready');
      } else {
        if (getSessionToken()) await persistSessionToken(null);
        resetSessionState();
        setAuthStatus('locked');
      }
    } catch (err) {
      // Never unlock without the server confirming the session; stay paired so we can retry
      setIsConnected(false);
      setAuthNotice(errorMessage(err));
      if (authStatusRef.current !== 'ready') {
        // Locked means no session on this phone: drop any leftover token and try to revoke it
        const leftover = getSessionToken();
        if (leftover) {
          await persistSessionToken(null);
          logoutSession(leftover).catch(() => {});
        }
        setAuthStatus('locked');
      }
    }
  }, [resetSessionState]);

  // Boot: load stored server/tokens, then ask the server
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readAllStored();
      if (cancelled) return;
      setServerBaseUrl(stored.serverUrl ?? '');
      setServerUrlState(getServerBaseUrl());
      setDeviceToken(stored.deviceToken);
      setSessionToken(stored.sessionToken);
      await checkAuth();
    })();
    return () => {
      cancelled = true;
    };
  }, [checkAuth]);

  // Any 401 on a normal call: the session ended → lock, then re-check whether the device is still paired
  useEffect(() => {
    setOnUnauthorized((tokenUsed) => {
      if (tokenUsed !== getSessionToken()) return; // stale response from an earlier session
      lock('Your session ended. Sign in again.');
      void checkAuth();
    });
    return () => setOnUnauthorized(null);
  }, [lock, checkAuth]);

  // Auto-lock when the app goes to the background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && authStatusRef.current === 'ready') lock();
    });
    return () => sub.remove();
  }, [lock]);

  // Auto-lock after 2 minutes without touches
  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (authStatus !== 'ready') return;
    lastActivityRef.current = Date.now();
    const id = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_LOCK_MS) lock('Locked after 2 minutes without activity.');
    }, IDLE_CHECK_MS);
    return () => clearInterval(id);
  }, [authStatus, lock]);

  // ---------- Data ----------

  const refreshData = useCallback(async () => {
    if (authStatusRef.current !== 'ready') return;
    const epoch = sessionEpochRef.current;
    try {
      const [tbls, items, ords, tickets] = await Promise.all([fetchTables(), fetchMenu(), fetchOrders(), fetchKOTs()]);
      if (epoch !== sessionEpochRef.current) return;
      setTables(tbls);
      setMenu(items);
      setOrders(ords);
      setKots(tickets);
      setIsConnected(true);
    } catch (err) {
      if (errorStatus(err) === 0) setIsConnected(false);
    }
  }, []);

  // Poll only while a staff member is signed in
  useEffect(() => {
    if (authStatus !== 'ready') return;
    refreshData();
    const id = setInterval(refreshData, POLL_MS);
    return () => clearInterval(id);
  }, [authStatus, refreshData]);

  const runPingTest = useCallback(async () => {
    const res = await pingServer();
    setPingStats({
      latencyMs: res.latencyMs,
      message: res.message,
      lastPing: new Date().toLocaleTimeString(),
    });
    setIsConnected(res.success);
  }, []);

  // ---------- Pairing & sign-in ----------

  const pair = useCallback(async (url: string, code: string): Promise<ActionResult> => {
    const normalized = normalizeServerUrl(url);
    if (!normalized) return { success: false, error: 'Enter the server address' };
    if (!/^\d{6}$/.test(code)) return { success: false, error: 'Enter the 6-digit pairing code' };

    setServerBaseUrl(normalized);
    setServerUrlState(normalized);
    await writeStored('serverUrl', normalized);
    // A new pairing replaces any old tokens
    await persistSessionToken(null);
    await persistDeviceToken(null);

    try {
      const result = await pairDevice(code);
      await persistDeviceToken(result.deviceToken);
      if (result.device.type === 'DISPLAY') {
        await unpairDevice().catch(() => {});
        await persistDeviceToken(null);
        return {
          success: false,
          error: 'That code is for a station display. Create a code for a Mobile device instead.',
        };
      }
      setDevice(result.device);
      setIsConnected(true);
      setAuthNotice(null);
      setAuthStatus('locked');
      return { success: true };
    } catch (err) {
      return failure(err);
    }
  }, []);

  const signIn = useCallback(
    async (userId: string, pin: string): Promise<ActionResult> => {
      let token: string | null = null;
      try {
        const res = await signInWithPin(userId, pin);
        token = res.sessionToken;
        await persistSessionToken(token);
        const me = await fetchAuthMe();
        if (!me.user) throw new ApiError(401, 'Sign in failed. Try again.');
        sessionEpochRef.current += 1;
        setDevice(me.device);
        setCurrentStaff(me.user);
        setPermissions(me.permissions);
        setAuthNotice(null);
        setIsConnected(true);
        lastActivityRef.current = Date.now();
        setAuthStatus('ready');
        return { success: true };
      } catch (err) {
        if (token) {
          // PIN was accepted but we couldn't finish: don't leave a live session behind
          await persistSessionToken(null);
          logoutSession(token).catch(() => {});
        }
        if (errorStatus(err) === 401 && /paired/i.test(errorMessage(err))) void checkAuth();
        return failure(err);
      }
    },
    [checkAuth]
  );

  const unpair = useCallback(async (): Promise<ActionResult> => {
    let serverError: string | null = null;
    try {
      await unpairDevice();
    } catch (err) {
      serverError = errorMessage(err);
    }
    // Forget the tokens on this phone either way
    resetSessionState();
    await persistSessionToken(null);
    await persistDeviceToken(null);
    setDevice(null);
    setAuthNotice(null);
    setAuthStatus('unpaired');
    if (serverError) {
      return {
        success: false,
        error: `Removed from this phone, but the server could not be reached (${serverError}). Revoke it in Admin → Devices.`,
      };
    }
    return { success: true };
  }, [resetSessionState]);

  const changePin = useCallback(async (currentPin: string, newPin: string): Promise<ActionResult> => {
    try {
      await changeOwnPin(currentPin, newPin);
      return { success: true };
    } catch (err) {
      return failure(err);
    }
  }, []);

  const changeServerUrl = useCallback(
    async (url: string): Promise<ActionResult> => {
      const normalized = normalizeServerUrl(url);
      if (!normalized) return { success: false, error: 'Enter the server address' };
      if (normalized === getServerBaseUrl()) return { success: true };
      lock(); // signs out on the old server before switching
      setServerBaseUrl(normalized);
      setServerUrlState(normalized);
      await writeStored('serverUrl', normalized);
      await checkAuth();
      return { success: true };
    },
    [lock, checkAuth]
  );

  const can = useCallback((permission: Permission) => permissions.includes(permission), [permissions]);

  // ---------- Cart ----------

  const categories = useMemo(() => {
    const set = new Set<string>();
    menu.forEach((m) => set.add(m.category));
    return ['All', ...Array.from(set)];
  }, [menu]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === item.id);
      if (existing) {
        return prev.map((x) => (x.id === item.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((x) => {
          if (x.id === id) {
            const newQty = x.qty + delta;
            return newQty > 0 ? { ...x, qty: newQty } : null;
          }
          return x;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = useMemo(() => cart.reduce((sum, it) => sum + it.price * it.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, it) => sum + it.qty, 0), [cart]);
  const hasShishaInCart = useMemo(() => cart.some((it) => it.station === 'Shisha Master'), [cart]);

  const activeOrder = useMemo(() => {
    return orders.find((o) => !o.closed && o.tableName === selectedTable);
  }, [orders, selectedTable]);

  // ---------- Actions ----------

  /** Runs a server action, refreshes data on success, and returns a consistent result */
  const runAction = async (action: () => Promise<unknown>, onSuccess?: () => void): Promise<ActionResult> => {
    setLoading(true);
    try {
      await action();
      onSuccess?.();
      await refreshData();
      return { success: true };
    } catch (err) {
      return failure(err);
    } finally {
      setLoading(false);
    }
  };

  const punchKOT = (params: {
    guestName?: string;
    guestPhone?: string;
    notes?: string;
    shishaAdvance?: number;
    duration?: number;
  }) =>
    runAction(
      () =>
        submitMobileOrder({
          tableName: selectedTable,
          guestName: params.guestName,
          guestPhone: params.guestPhone,
          items: cart.map((c) => ({
            name: c.name,
            price: c.price,
            station: c.station,
            category: c.category,
            qty: c.qty,
            notes: c.notes,
          })),
          notes: params.notes,
          shishaAdvance: params.shishaAdvance,
          duration: hasShishaInCart ? params.duration : undefined,
        }),
      clearCart
    );

  const transferTable = async (fromTable: string, toTable: string, reason?: string) => {
    if (!activeOrder) return { success: false, error: 'No active order found for table' };
    const orderId = activeOrder.id;
    return runAction(
      () => transferTableOrder({ orderId, fromTable, toTable, reason }),
      () => setSelectedTable(toTable)
    );
  };

  const voidItem = (orderId: string, itemIndex: number, voidReason: string, managerPin?: string) =>
    runAction(() => voidOrderItem({ orderId, itemIndex, voidReason, pin: managerPin || undefined }));

  const updateKOT = (kotId: string, status: string) => runAction(() => updateKOTStatus(kotId, status));

  const extendShisha = (kotId: string, minutes: number = 15) => runAction(() => extendShishaPot(kotId, minutes));

  const settleBill = (params: {
    orderId: string;
    payment?: PaymentLine;
    payments?: PaymentLine[];
    discount?: number;
    discountReason?: string;
    taxPercent?: number;
    approvalPin?: string;
  }) =>
    runAction(() =>
      settleOrderBill({ ...params, approvalPin: params.approvalPin || undefined, closeOrder: true })
    );

  const mergeTables = (sourceTable: string, targetTable: string) =>
    runAction(
      () => mergeTableOrders({ sourceTable, targetTable }),
      () => setSelectedTable(targetTable)
    );

  const voidOrder = (orderId: string, table: string, voidReason: string, managerPin?: string) =>
    runAction(() => voidWholeOrder({ orderId, table, voidReason, pin: managerPin || undefined }));

  const toggle86 = (itemId: string, isAvailable: boolean) =>
    runAction(
      () => toggleMenuItemAvailability(itemId, isAvailable),
      () => setMenu((prev) => prev.map((m) => (m.id === itemId ? { ...m, isAvailable } : m)))
    );

  return (
    <POSContext.Provider
      value={{
        isConnected,
        serverUrl,
        changeServerUrl,
        loading,
        refreshData,
        pingStats,
        runPingTest,
        authStatus,
        device,
        currentStaff,
        permissions,
        can,
        authNotice,
        checkAuth,
        pair,
        signIn,
        lock,
        unpair,
        changePin,
        markActivity,
        tables,
        menu,
        orders,
        kots,
        categories,
        activeOrder,
        selectedFloor,
        setSelectedFloor,
        selectedTable,
        setSelectedTable,
        cart,
        addToCart,
        updateCartQty,
        clearCart,
        cartCount,
        cartTotal,
        hasShishaInCart,
        punchKOT,
        extendShisha,
        transferTable,
        voidItem,
        updateKOT,
        settleBill,
        mergeTables,
        voidOrder,
        toggle86,
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
}
