import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { TableItem, MenuItem, CartItem, Order, KOT, StaffUser } from '../types';
import {
  checkServerHealth,
  fetchTables,
  fetchMenu,
  fetchOrders,
  fetchKOTs,
  submitMobileOrder,
  extendShishaPot,
  transferTableOrder,
  voidOrderItem,
  updateKOTStatus,
  fetchStaffUsers,
  verifyStaffPin,
  resetStaffPin,
  pingServer,
  settleOrderBill,
  mergeTableOrders,
  voidWholeOrder,
  toggleMenuItemAvailability,
  getServerBaseUrl,
  setServerBaseUrl,
} from '../services/api';

const DEFAULT_STAFF: StaffUser = {
  id: 'captain-1',
  name: 'Captain 1',
  role: 'CAPTAIN',
  phone: '9876543212',
};

interface PingStats {
  latencyMs: number;
  message: string;
  lastPing: string;
}

interface POSContextType {
  // Connectivity & Server
  isConnected: boolean;
  serverUrl: string;
  updateServerUrl: (url: string) => void;
  loading: boolean;
  refreshData: () => Promise<void>;
  pingStats: PingStats | null;
  runPingTest: () => Promise<void>;

  // Staff User & Auth
  currentStaff: StaffUser;
  setCurrentStaff: (staff: StaffUser) => void;
  staffUsers: StaffUser[];
  isLocked: boolean;
  lockTerminal: () => void;
  unlockTerminal: (pin: string) => Promise<{ success: boolean; staff?: StaffUser; error?: string }>;
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; message?: string; error?: string }>;

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
  }) => Promise<{ success: boolean; error?: string }>;
  extendShisha: (kotId: string, minutes?: number) => Promise<void>;
  transferTable: (fromTable: string, toTable: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  voidItem: (orderId: string, itemIndex: number, voidReason: string, pin?: string) => Promise<{ success: boolean; error?: string }>;
  updateKOT: (kotId: string, status: string) => Promise<void>;
  settleBill: (params: {
    orderId: string;
    payment?: { amount: number; method: string; creditRef?: string };
    payments?: { amount: number; method: string; creditRef?: string }[];
    discount?: number;
    discountReason?: string;
    taxPercent?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  mergeTables: (sourceTable: string, targetTable: string) => Promise<{ success: boolean; error?: string }>;
  voidOrder: (orderId: string, table: string, voidReason: string, pin?: string) => Promise<{ success: boolean; error?: string }>;
  toggle86: (itemId: string, isAvailable: boolean) => Promise<{ success: boolean; error?: string }>;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [serverUrl, setServerUrl] = useState(getServerBaseUrl());
  const [loading, setLoading] = useState(false);
  const [pingStats, setPingStats] = useState<PingStats | null>(null);

  // Staff State
  const [currentStaff, setCurrentStaff] = useState<StaffUser>(DEFAULT_STAFF);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [isLocked, setIsLocked] = useState(false);

  // Restaurant Data
  const [tables, setTables] = useState<TableItem[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [kots, setKots] = useState<KOT[]>([]);

  const [selectedFloor, setSelectedFloor] = useState('All');
  const [selectedTable, setSelectedTable] = useState('Table 1');
  const [cart, setCart] = useState<CartItem[]>([]);

  const updateServerUrl = (url: string) => {
    setServerBaseUrl(url);
    setServerUrl(url);
  };

  const runPingTest = useCallback(async () => {
    const res = await pingServer();
    setPingStats({
      latencyMs: res.latencyMs,
      message: res.message,
      lastPing: new Date().toLocaleTimeString(),
    });
    setIsConnected(res.success);
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const health = await checkServerHealth();
      setIsConnected(health.success);

      const [tbls, items, ords, tickets, staffList] = await Promise.all([
        fetchTables(),
        fetchMenu(),
        fetchOrders(),
        fetchKOTs(),
        fetchStaffUsers(),
      ]);

      setTables(tbls);
      setMenu(items);
      setOrders(ords);
      setKots(tickets);
      if (staffList.length > 0) {
        setStaffUsers(staffList);
      }
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    runPingTest();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData, runPingTest]);

  const lockTerminal = () => {
    setIsLocked(true);
  };

  const unlockTerminal = async (pin: string): Promise<{ success: boolean; staff?: StaffUser; error?: string }> => {
    const res = await verifyStaffPin(pin);
    if (res.success && res.data) {
      setCurrentStaff(res.data);
      setIsLocked(false);
      return { success: true, staff: res.data };
    }
    return { success: false, error: res.error || 'Invalid Staff PIN' };
  };

  const changePin = async (
    currentPin: string,
    newPin: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    const res = await resetStaffPin({
      userId: currentStaff.id,
      staffName: currentStaff.name,
      currentPin,
      newPin,
    });
    if (res.success) {
      // Refresh staff list
      const staffList = await fetchStaffUsers();
      if (staffList.length > 0) setStaffUsers(staffList);
      return { success: true, message: res.message || 'PIN updated successfully' };
    }
    return { success: false, error: res.error || 'Failed to update PIN' };
  };

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

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, it) => sum + it.price * it.qty, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, it) => sum + it.qty, 0);
  }, [cart]);

  const hasShishaInCart = useMemo(() => {
    return cart.some((it) => it.station === 'Shisha Master');
  }, [cart]);

  const punchKOT = async (params: {
    guestName?: string;
    guestPhone?: string;
    notes?: string;
    shishaAdvance?: number;
    duration?: number;
  }) => {
    setLoading(true);
    const result = await submitMobileOrder({
      tableName: selectedTable,
      guestName: params.guestName,
      guestPhone: params.guestPhone,
      staffName: currentStaff.name,
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
    });
    setLoading(false);

    if (result.success) {
      clearCart();
      await refreshData();
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const activeOrder = useMemo(() => {
    return orders.find((o) => !o.closed && o.tableName === selectedTable);
  }, [orders, selectedTable]);

  const transferTable = async (fromTable: string, toTable: string, reason?: string) => {
    if (!activeOrder) return { success: false, error: 'No active order found for table' };
    setLoading(true);
    const res = await transferTableOrder({
      orderId: activeOrder.id,
      fromTable,
      toTable,
      staff: currentStaff.name,
      reason,
    });
    setLoading(false);
    if (res.success) {
      setSelectedTable(toTable);
      await refreshData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const voidItem = async (orderId: string, itemIndex: number, voidReason: string, pin?: string) => {
    setLoading(true);
    const res = await voidOrderItem({
      orderId,
      itemIndex,
      voidReason,
      pin,
      staff: currentStaff.name,
    });
    setLoading(false);
    if (res.success) {
      await refreshData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const updateKOT = async (kotId: string, status: string) => {
    await updateKOTStatus(kotId, status);
    await refreshData();
  };

  const extendShisha = async (kotId: string, minutes: number = 15) => {
    await extendShishaPot(kotId, minutes);
    await refreshData();
  };

  const settleBill = async (params: {
    orderId: string;
    payment?: { amount: number; method: string; creditRef?: string };
    payments?: { amount: number; method: string; creditRef?: string }[];
    discount?: number;
    discountReason?: string;
    taxPercent?: number;
  }) => {
    setLoading(true);
    const res = await settleOrderBill({
      ...params,
      closeOrder: true,
    });
    setLoading(false);
    if (res.success) {
      await refreshData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const mergeTables = async (sourceTable: string, targetTable: string) => {
    setLoading(true);
    const res = await mergeTableOrders({
      sourceTable,
      targetTable,
      staff: currentStaff.name,
    });
    setLoading(false);
    if (res.success) {
      setSelectedTable(targetTable);
      await refreshData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const voidOrder = async (orderId: string, table: string, voidReason: string, pin?: string) => {
    setLoading(true);
    const res = await voidWholeOrder({
      orderId,
      table,
      voidReason,
      pin,
      staff: currentStaff.name,
    });
    setLoading(false);
    if (res.success) {
      await refreshData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const toggle86 = async (itemId: string, isAvailable: boolean) => {
    const res = await toggleMenuItemAvailability(itemId, isAvailable);
    if (res.success) {
      setMenu((prev) =>
        prev.map((m) => (m.id === itemId ? { ...m, isAvailable } : m))
      );
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  return (
    <POSContext.Provider
      value={{
        isConnected,
        serverUrl,
        updateServerUrl,
        loading,
        refreshData,
        pingStats,
        runPingTest,
        currentStaff,
        setCurrentStaff,
        staffUsers,
        isLocked,
        lockTerminal,
        unlockTerminal,
        changePin,
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
