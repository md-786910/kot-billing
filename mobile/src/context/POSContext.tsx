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
  newIdempotencyKey,
  isStillProcessing,
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
  fetchSyncVersion,
} from '../services/api';
import { readAllStored, writeStored } from '../services/storage';

/** booting → (unpaired | locked) → ready. Data is only loaded while `ready`. */
export type AuthStatus = 'booting' | 'unpaired' | 'locked' | 'ready';

export interface ActionResult {
  success: boolean;
  error?: string;
  /** HTTP status of the failure (0 = network/timeout) */
  status?: number;
  /** Another action was still running, so this one was not sent (e.g. a double tap) */
  busy?: boolean;
  /** No clear answer (timeout, or the server is still processing it): data was refreshed, check before retrying */
  uncertain?: boolean;
}

const IDLE_LOCK_MS = 2 * 60_000;
const IDLE_CHECK_MS = 5_000;
// Cheap version check every few seconds; the four data lists reload only when something changed
// (plus a full reload every minute as a safety net). Keeps server calls low on serverless hosting.
const SYNC_MS = 5_000;
const FULL_REFRESH_MS = 60_000;
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
  /**
   * Forget this phone's pairing and go to the pairing screen (optionally pre-filling a new address).
   * A device token is never sent to a different server.
   */
  changeServer: (newUrl?: string) => Promise<void>;
  /** The last auth check could not use the server (unreachable, wrong address, server error) */
  serverUnreachable: boolean;
  /** Called when a server call succeeds from the lock screen */
  markServerReachable: () => void;
  /** True while the app is not in the foreground (iOS app switcher): screens hide behind a plain cover */
  privacyCover: boolean;
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
    /** One key per settlement attempt; reuse it when retrying the same bill */
    idempotencyKey: string;
  }) => Promise<ActionResult>;
  mergeTables: (sourceTable: string, targetTable: string) => Promise<ActionResult>;
  voidOrder: (orderId: string, table: string, voidReason: string, managerPin?: string) => Promise<ActionResult>;
  toggle86: (itemId: string, isAvailable: boolean) => Promise<ActionResult>;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

function failure(err: unknown): ActionResult {
  return { success: false, error: errorMessage(err), status: errorStatus(err) };
}

// Staff sessions are kept in memory only, so a restarted app always starts at the PIN lock
async function persistDeviceToken(token: string | null) {
  setDeviceToken(token);
  await writeStored('deviceToken', token);
}

const NOT_PAIRED_NOTICE = "This phone isn't paired with the server. Enter a new pairing code.";
const CHANGE_SERVER_NOTICE = 'Enter the server address and a new pairing code from Staff & Devices.';
const BUSY_MESSAGE = 'Still working on the last action. Please wait.';

type Notice = { text: string; /** connection/server trouble: cleared once the server answers again */ network: boolean };

function isForeground(state: string | null | undefined) {
  return state !== 'background' && state !== 'inactive';
}

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
  const [notice, setNotice] = useState<Notice | null>(null);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [appActive, setAppActive] = useState(() => isForeground(AppState.currentState));

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
  // Bumped on every lock/sign-in so responses from a previous session are dropped
  const sessionEpochRef = useRef(0);
  // The running server action (one at a time); a new object per action so a lock can release it safely
  const actionInFlightRef = useRef<object | null>(null);

  // ---------- Session helpers ----------

  const resetSessionState = useCallback(() => {
    sessionEpochRef.current += 1;
    actionInFlightRef.current = null;
    setLoading(false);
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
      setSessionToken(null);
      if (token) logoutSession(token).catch(() => {});
      setNotice(reason ? { text: reason, network: false } : null);
      setAuthStatus((s) => (s === 'ready' ? 'locked' : s));
    },
    [resetSessionState]
  );

  /** Drop the device token (and any session) on this phone and show the pairing screen */
  const forgetDevice = useCallback(
    async (text: string | null) => {
      resetSessionState();
      setSessionToken(null);
      setDeviceToken(null);
      setDevice(null);
      setServerUnreachable(false);
      setNotice(text ? { text, network: false } : null);
      setAuthStatus('unpaired');
      await writeStored('deviceToken', null);
    },
    [resetSessionState]
  );

  const markServerReachable = useCallback(() => {
    setServerUnreachable(false);
    setIsConnected(true);
    setNotice((n) => (n?.network ? null : n));
  }, []);

  /**
   * Ask the server whether this phone is still paired and route to pairing or the PIN lock.
   * Never unlocks: only a PIN sign-in opens the app.
   */
  const checkAuth = useCallback(async () => {
    if (!getServerBaseUrl() || !getDeviceToken()) {
      setDevice(null);
      setAuthStatus('unpaired');
      return;
    }
    // A reply that arrives after a sign-in, lock or re-pair started meanwhile is out of date
    const epoch = sessionEpochRef.current;
    const tokenSent = getSessionToken();
    const deviceSent = getDeviceToken();
    const isStale = () =>
      epoch !== sessionEpochRef.current || tokenSent !== getSessionToken() || deviceSent !== getDeviceToken();

    try {
      const me = await fetchAuthMe();
      if (isStale()) return;
      markServerReachable();
      if (!me.device || me.device.type === 'DISPLAY') {
        // Revoked, or this token belongs to another server: start over with a new code
        await forgetDevice(NOT_PAIRED_NOTICE);
        return;
      }
      setDevice(me.device);
      if (tokenSent && !me.user) {
        lock('Your session ended. Sign in again.');
        return;
      }
      setAuthStatus((s) => (s === 'ready' ? s : 'locked'));
    } catch (err) {
      if (isStale()) return;
      // Stay paired so we can retry; the lock screen offers to change the server address
      setIsConnected(false);
      setServerUnreachable(true);
      setNotice({ text: errorMessage(err), network: true });
      setAuthStatus((s) => (s === 'ready' ? s : 'locked'));
    }
  }, [forgetDevice, lock, markServerReachable]);

  // Boot: load the stored server and device token, then ask the server. Always starts at the PIN lock.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readAllStored();
      if (cancelled) return;
      setServerBaseUrl(stored.serverUrl ?? '');
      setServerUrlState(getServerBaseUrl());
      setDeviceToken(stored.deviceToken);
      setSessionToken(null);
      if (stored.legacySessionToken) {
        // Older versions kept the staff session on disk: revoke it on the server and never resume it
        logoutSession(stored.legacySessionToken).catch(() => {});
        void writeStored('legacySessionToken', null);
      }
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

  // Cover the screen while inactive (iOS app switcher snapshot); lock when the app goes to the background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(isForeground(state));
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
    let lastVersion: number | null = null;
    let lastFull = Date.now();
    let busy = false;
    refreshData();
    const id = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const version = await fetchSyncVersion();
        const stale = Date.now() - lastFull > FULL_REFRESH_MS;
        if ((lastVersion !== null && version !== lastVersion) || stale) {
          lastFull = Date.now();
          await refreshData();
        }
        lastVersion = version;
        setIsConnected(true);
      } catch (err) {
        if (errorStatus(err) === 0) setIsConnected(false);
      } finally {
        busy = false;
      }
    }, SYNC_MS);
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
    setSessionToken(null);
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
      setServerUnreachable(false);
      setNotice(null);
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
        setSessionToken(token);
        const me = await fetchAuthMe();
        // Locked, unpaired or re-paired while this was running
        if (getSessionToken() !== token) throw new ApiError(0, 'Sign in was interrupted. Try again.');
        if (!me.user) throw new ApiError(401, 'Sign in failed. Try again.');
        sessionEpochRef.current += 1;
        setDevice(me.device);
        setCurrentStaff(me.user);
        setPermissions(me.permissions);
        setNotice(null);
        setServerUnreachable(false);
        setIsConnected(true);
        lastActivityRef.current = Date.now();
        setAuthStatus('ready');
        // Finished while the app was already in the background: don't leave it unlocked
        if (AppState.currentState === 'background') lock();
        return { success: true };
      } catch (err) {
        if (token) {
          // PIN was accepted but we couldn't finish: don't leave a live session behind
          if (getSessionToken() === token) setSessionToken(null);
          logoutSession(token).catch(() => {});
        }
        if (errorStatus(err) === 401 && /paired/i.test(errorMessage(err))) void checkAuth();
        return failure(err);
      }
    },
    [checkAuth, lock]
  );

  const unpair = useCallback(async (): Promise<ActionResult> => {
    let serverError: string | null = null;
    try {
      await unpairDevice();
    } catch (err) {
      serverError = errorMessage(err);
    }
    // Forget the tokens on this phone either way
    await forgetDevice(null);
    if (serverError) {
      return {
        success: false,
        error: `Removed from this phone, but the server could not be reached (${serverError}). Revoke it in Staff & Devices.`,
      };
    }
    return { success: true };
  }, [forgetDevice]);

  const changePin = useCallback(async (currentPin: string, newPin: string): Promise<ActionResult> => {
    try {
      await changeOwnPin(currentPin, newPin);
      return { success: true };
    } catch (err) {
      return failure(err);
    }
  }, []);

  const changeServer = useCallback(
    async (newUrl?: string) => {
      // Last calls to the old server (they read its address and tokens before anything below runs):
      // end the staff session and revoke this device there. Best effort: it may be unreachable.
      const token = getSessionToken();
      if (token) logoutSession(token).catch(() => {});
      if (getDeviceToken()) unpairDevice(5_000).catch(() => {});

      const next = newUrl ? normalizeServerUrl(newUrl) : '';
      if (next) {
        setServerBaseUrl(next);
        setServerUrlState(next);
      }
      await forgetDevice(CHANGE_SERVER_NOTICE);
      if (next) await writeStored('serverUrl', next);
    },
    [forgetDevice]
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

  // One idempotency key per cart submission: reused for retries, replaced when the cart or table changes
  const kotKeyRef = useRef<string | null>(null);
  useEffect(() => {
    kotKeyRef.current = null;
  }, [cart, selectedTable]);

  /**
   * Runs one server action at a time (a second tap is ignored), refreshes data afterwards, and
   * returns a consistent result. `onSuccess` only runs if the same staff session is still signed in.
   */
  const runAction = async (
    action: () => Promise<unknown>,
    onSuccess?: () => void,
    options: { idempotent?: boolean } = {}
  ): Promise<ActionResult> => {
    if (actionInFlightRef.current) return { success: false, busy: true, error: BUSY_MESSAGE };
    const inFlight = {};
    actionInFlightRef.current = inFlight;
    const epoch = sessionEpochRef.current;
    setLoading(true);
    try {
      await action();
      if (epoch === sessionEpochRef.current) onSuccess?.();
      await refreshData();
      return { success: true };
    } catch (err) {
      const result = failure(err);
      const stillProcessing = isStillProcessing(result.status, result.error);
      if (result.status === 0 || stillProcessing) {
        // The server may have applied it: show the latest data before a retry is possible
        await refreshData();
        const retryNote = options.idempotent ? " Trying again won't apply it twice." : '';
        return {
          ...result,
          uncertain: true,
          error: stillProcessing
            ? `The server is still working on this. The screen has been refreshed — check it before trying again.${retryNote}`
            : `No reply from the server, so this may or may not have gone through. The screen has been refreshed — check it before trying again.${retryNote}`,
        };
      }
      return result;
    } finally {
      if (actionInFlightRef.current === inFlight) {
        actionInFlightRef.current = null;
        setLoading(false);
      }
    }
  };

  const punchKOT = (params: {
    guestName?: string;
    guestPhone?: string;
    notes?: string;
    shishaAdvance?: number;
    duration?: number;
  }) => {
    if (cart.length === 0) return Promise.resolve<ActionResult>({ success: false, error: 'The cart is empty.' });
    const idempotencyKey = (kotKeyRef.current ??= newIdempotencyKey());
    return runAction(
      () =>
        submitMobileOrder({
          idempotencyKey,
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
      () => {
        kotKeyRef.current = null;
        clearCart();
      },
      { idempotent: true }
    );
  };

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
    idempotencyKey: string;
  }) =>
    runAction(
      () => settleOrderBill({ ...params, approvalPin: params.approvalPin || undefined, closeOrder: true }),
      undefined,
      { idempotent: true }
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
        changeServer,
        serverUnreachable,
        markServerReachable,
        privacyCover: !appActive,
        loading,
        refreshData,
        pingStats,
        runPingTest,
        authStatus,
        device,
        currentStaff,
        permissions,
        can,
        authNotice: notice?.text ?? null,
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
