import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { TableItem, MenuItem, CartItem, Order, KOT } from '../types';
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
  getServerBaseUrl,
  setServerBaseUrl,
} from '../services/api';

interface POSContextType {
  // Connectivity
  isConnected: boolean;
  serverUrl: string;
  updateServerUrl: (url: string) => void;
  loading: boolean;
  refreshData: () => Promise<void>;

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
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [serverUrl, setServerUrl] = useState(getServerBaseUrl());
  const [loading, setLoading] = useState(false);

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

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const health = await checkServerHealth();
      setIsConnected(health.success);

      const [tbls, items, ords, tickets] = await Promise.all([
        fetchTables(),
        fetchMenu(),
        fetchOrders(),
        fetchKOTs(),
      ]);

      setTables(tbls);
      setMenu(items);
      setOrders(ords);
      setKots(tickets);
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

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
      staffName: 'Captain 1',
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
      staff: 'Captain 1',
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
      staff: 'Captain 1',
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

  return (
    <POSContext.Provider
      value={{
        isConnected,
        serverUrl,
        updateServerUrl,
        loading,
        refreshData,
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
