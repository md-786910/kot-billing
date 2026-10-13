"use client";
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  MenuItem,
  CartItem,
  TableInfo,
  Order,
  OrderItem,
  PrivateBooking,
  Station,
} from '../types/pos';
import { formatINR, formatDateTime, getElapsedMinutes } from '../utils/format';
import { playOrderChime } from '../utils/audio';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  Flame,
  ChefHat,
  GlassWater,
  User,
  Phone,
  Layers,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  ArrowRightLeft,
  GitMerge,
  ShieldAlert,
  AlertTriangle,
  X,
  Lock,
  Tag,
  ToggleLeft,
  ToggleRight,
  Receipt,
  UtensilsCrossed,
  Ban,
  Check,
} from 'lucide-react';

interface POSOrderViewProps {
  menu: MenuItem[];
  tables: TableInfo[];
  orders: Order[];
  bookings: PrivateBooking[];
  currentLocation: string;
  onSelectLocation: (loc: string) => void;
  onSubmitOrder: (orderData: {
    location: string;
    guest: string;
    phone: string;
    staff: string;
    bookingId: string | null;
    items: CartItem[];
    notes: string;
    shishaAdvance: number;
    duration: number;
    idempotencyKey: string;
  }) => Promise<boolean>;
  onGoToBooking: (venue: 'VIP Lounge' | 'Couple Cabin') => void;
  onGoToBilling?: (orderId: string) => void;
  onRefresh?: () => void;
}

const QUICK_NOTES = [
  '🌶️ Less Spicy',
  '🍟 Extra Crispy',
  '🧊 Cold Ice',
  '🔥 Double Coal',
  '💧 Mineral Water Base',
  '🧄 No Onion/Garlic',
  '📦 Separate Parcel',
  '🍃 Paan+Mint Mix',
  '🍋 Extra Lemon',
];

const VOID_REASONS = [
  'Guest Cancelled / Left Early',
  'Punched by Mistake / Wrong Item',
  'Food/Beverage Defective or Cold',
  'Item Out of Stock / Kitchen 86',
  'Guest Disliked Taste / Replaced',
  'Management Courtesy Discretion',
];

// Random request id; works on plain-HTTP LAN terminals where crypto.randomUUID is unavailable
function requestKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const POSOrderView: React.FC<POSOrderViewProps> = ({
  menu,
  tables,
  orders,
  bookings,
  currentLocation,
  onSelectLocation,
  onSubmitOrder,
  onGoToBooking,
  onGoToBilling,
  onRefresh,
}) => {
  // Filters & State
  const [tableFilter, setTableFilter] = useState<'all' | 'vacant' | 'occupied'>('all');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const auth = useAuth();
  const signedInName = auth.user?.name ?? '';
  const canVoid = auth.can('order.void');
  const [staff, setStaff] = useState<string>(signedInName);
  const [linkedBookingId, setLinkedBookingId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [shishaAdvance, setShishaAdvance] = useState<number>(0);
  const [shishaDuration, setShishaDuration] = useState<number>(45);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // 86 Manager Mode
  const [is86ManagerMode, setIs86ManagerMode] = useState<boolean>(false);

  // Table Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [targetTable, setTargetTable] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('Guest request');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Table Merge Modal
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetTable, setMergeTargetTable] = useState<string>('');
  const [isMerging, setIsMerging] = useState<boolean>(false);

  // Void Entire Order / Emergency Walkout Modal
  const [isVoidOrderModalOpen, setIsVoidOrderModalOpen] = useState(false);
  const [voidOrderReason, setVoidOrderReason] = useState<string>('Guest Walkout / Emergency');
  const [voidOrderPin, setVoidOrderPin] = useState<string>('');
  const [isVoidingEntireOrder, setIsVoidingEntireOrder] = useState<boolean>(false);

  // Void Item Modal
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedVoidItemIndex, setSelectedVoidItemIndex] = useState<number | null>(null);
  const [selectedVoidItem, setSelectedVoidItem] = useState<OrderItem | null>(null);
  const [voidReason, setVoidReason] = useState<string>(VOID_REASONS[0]);
  const [supervisorPin, setSupervisorPin] = useState<string>('');
  const [isVoiding, setIsVoiding] = useState<boolean>(false);

  // Active open orders lookup
  const activeOrdersMap = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach((o) => {
      if (!o.closed) {
        map.set(o.location, o);
      }
    });
    return map;
  }, [orders]);

  const currentActiveOrder = activeOrdersMap.get(currentLocation);

  // Vacant tables available for transfer
  const vacantTables = useMemo(() => {
    return tables.filter((t) => !activeOrdersMap.has(t.name) && t.name !== currentLocation);
  }, [tables, activeOrdersMap, currentLocation]);

  // Occupied tables available for merging
  const occupiedMergeTables = useMemo(() => {
    return tables.filter((t) => activeOrdersMap.has(t.name) && t.name !== currentLocation);
  }, [tables, activeOrdersMap, currentLocation]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    menu.forEach((m) => set.add(m.category));
    return ['All', ...Array.from(set)];
  }, [menu]);

  // Filtered menu items
  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchCat = activeCategory === 'All' || item.category === activeCategory;
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menu, activeCategory, searchQuery]);

  // Quick Shisha add-on shortcuts
  const quickAddons = useMemo(() => {
    return menu.filter((m) => m.category === 'Shisha Extras' && m.isAvailable);
  }, [menu]);

  // Cart operations
  const addToCart = (item: MenuItem) => {
    if (is86ManagerMode) {
      handleToggle86(item);
      return;
    }

    if (!item.isAvailable) {
      setErrorToast(`${item.name} is currently 86'd / OUT OF STOCK.`);
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((x) => x.id === item.id);
      if (existing) {
        return prev.map((x) => (x.id === item.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
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

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((x) => x.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setNotes('');
    setShishaAdvance(0);
  };

  // Table selection with auto-linking
  const handleSelectTable = (tableId: string) => {
    onSelectLocation(tableId);
    const existingOrder = activeOrdersMap.get(tableId);
    if (existingOrder) {
      setGuestName(existingOrder.guest || '');
      setGuestPhone(existingOrder.phone || '');
      setStaff(existingOrder.staff || signedInName);
      setLinkedBookingId(existingOrder.bookingId || '');
    } else {
      const matchedBooking = bookings.find(
        (b) => b.venue === tableId && b.status === 'ACTIVE'
      );
      if (matchedBooking) {
        setGuestName(matchedBooking.guest);
        setGuestPhone(matchedBooking.phone);
        setLinkedBookingId(matchedBooking.id);
      }
    }
  };

  // Quick note appender
  const handleAddQuickNote = (noteText: string) => {
    setNotes((prev) => {
      if (!prev.trim()) return noteText;
      return `${prev}, ${noteText}`;
    });
  };

  // 86 toggle handler
  const handleToggle86 = async (item: MenuItem) => {
    try {
      const nextStatus = !item.isAvailable;
      const res = await fetch('/api/v1/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          isAvailable: nextStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessToast(`${item.name} marked ${nextStatus ? 'AVAILABLE' : '86 / OUT OF STOCK'}`);
        setTimeout(() => setSuccessToast(null), 3500);
        if (onRefresh) onRefresh();
      }
    } catch {
      setErrorToast('Failed to update stock availability');
      setTimeout(() => setErrorToast(null), 3000);
    }
  };

  // Table transfer executor
  const handleExecuteTransfer = async () => {
    if (!currentActiveOrder) return;
    if (!targetTable) {
      alert('Please select a destination vacant table.');
      return;
    }
    setIsTransferring(true);
    try {
      const res = await fetch('/api/v1/orders/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentActiveOrder.id,
          fromTable: currentLocation,
          toTable: targetTable,
          staff,
          reason: transferReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessToast(`Table shifted successfully from ${currentLocation} to ${targetTable}!`);
        setIsTransferModalOpen(false);
        onSelectLocation(targetTable);
        if (onRefresh) onRefresh();
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        alert(json.error || 'Failed to shift table');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing table transfer');
    } finally {
      setIsTransferring(false);
    }
  };

  // Table merge executor
  const handleExecuteMerge = async () => {
    if (!currentActiveOrder || !mergeTargetTable) return;
    setIsMerging(true);
    try {
      const res = await fetch('/api/v1/orders/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTable: currentLocation,
          targetTable: mergeTargetTable,
          staff,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessToast(`Table ${currentLocation} successfully merged into ${mergeTargetTable}!`);
        setIsMergeModalOpen(false);
        onSelectLocation(mergeTargetTable);
        if (onRefresh) onRefresh();
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        alert(json.error || 'Failed to merge tables');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing table merge');
    } finally {
      setIsMerging(false);
    }
  };

  // Void entire order executor
  const handleExecuteVoidEntireOrder = async () => {
    if (!currentActiveOrder) return;
    if (!voidOrderReason.trim()) {
      alert('Please enter a cancellation reason.');
      return;
    }
    setIsVoidingEntireOrder(true);
    try {
      const res = await fetch('/api/v1/orders/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentActiveOrder.id,
          table: currentLocation,
          voidEntireOrder: true,
          voidReason: voidOrderReason.trim(),
          pin: voidOrderPin.trim() || undefined,
          staff,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessToast(`Order for Table ${currentLocation} has been voided and table released.`);
        setIsVoidOrderModalOpen(false);
        setVoidOrderReason('Guest Walkout / Emergency');
        setVoidOrderPin('');
        if (onRefresh) onRefresh();
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        alert(json.error || 'Failed to void order');
      }
    } catch (err: any) {
      alert(err.message || 'Error voiding order');
    } finally {
      setIsVoidingEntireOrder(false);
    }
  };

  // Void item executor
  const handleExecuteVoid = async () => {
    if (!currentActiveOrder || selectedVoidItemIndex === null) return;
    if (!voidReason.trim()) {
      alert('A void reason is mandatory.');
      return;
    }
    setIsVoiding(true);
    try {
      const res = await fetch('/api/v1/orders/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentActiveOrder.id,
          itemIndex: selectedVoidItemIndex,
          voidReason: voidReason.trim(),
          pin: supervisorPin.trim() || undefined,
          staff,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessToast(`Item voided: ${selectedVoidItem?.name}. Station void ticket generated.`);
        setIsVoidModalOpen(false);
        setSelectedVoidItemIndex(null);
        setSelectedVoidItem(null);
        setSupervisorPin('');
        if (onRefresh) onRefresh();
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        alert(json.error || 'Void authorization rejected');
      }
    } catch (err: any) {
      alert(err.message || 'Error processing item void');
    } finally {
      setIsVoiding(false);
    }
  };

  // Cart math
  const cartSubtotal = cart.reduce((sum, it) => sum + it.price * it.qty, 0);
  const cartItemCount = cart.reduce((sum, it) => sum + it.qty, 0);

  // Running order items math (excluding voided items)
  const runningActiveItems = useMemo(() => {
    if (!currentActiveOrder) return [];
    return currentActiveOrder.items.filter((it) => !it.isVoided);
  }, [currentActiveOrder]);

  const runningVoidedItems = useMemo(() => {
    if (!currentActiveOrder) return [];
    return currentActiveOrder.items.filter((it) => it.isVoided);
  }, [currentActiveOrder]);

  const runningSubtotal = useMemo(() => {
    return runningActiveItems.reduce((s, it) => s + it.price * it.qty, 0);
  }, [runningActiveItems]);

  // One key per cart submission: retries after a timeout reuse it, so the kitchen never gets a duplicate KOT
  const submittingRef = useRef(false);
  const submitKeyRef = useRef<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOrderSubmit = async () => {
    if (submittingRef.current) return;
    if (cart.length === 0) {
      alert('Please select at least one menu item to create the order docket.');
      return;
    }

    if (
      (currentLocation === 'VIP Lounge' || currentLocation === 'Couple Cabin') &&
      !linkedBookingId
    ) {
      const confirmProceed = window.confirm(
        `${currentLocation} is a private space with hourly rates. Do you want to proceed as a walk-in without a linked booking?`
      );
      if (!confirmProceed) return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    submitKeyRef.current ??= requestKey();
    const saved = await onSubmitOrder({
      location: currentLocation,
      guest: guestName.trim(),
      phone: guestPhone.trim(),
      staff,
      bookingId: linkedBookingId || null,
      items: cart,
      notes: notes.trim(),
      shishaAdvance: Number(shishaAdvance) || 0,
      duration: Number(shishaDuration) || 45,
      idempotencyKey: submitKeyRef.current,
    });
    submittingRef.current = false;
    setIsSubmitting(false);
    if (!saved) return;

    submitKeyRef.current = null;
    setSuccessToast(`Order punched for ${currentLocation}! Station KOTs generated.`);
    clearCart();
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alerts */}
      {successToast && (
        <div className="p-4 bg-emerald-950/90 border border-emerald-500 text-emerald-100 rounded-xl flex items-center justify-between shadow-xl animate-fade-in backdrop-blur-md">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-bold text-sm tracking-wide">{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-300 text-xs hover:underline cursor-pointer font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorToast && (
        <div className="p-4 bg-rose-950/90 border border-rose-500 text-rose-100 rounded-xl flex items-center justify-between shadow-xl animate-fade-in backdrop-blur-md">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-bold text-sm tracking-wide">{errorToast}</span>
          </div>
          <button
            onClick={() => setErrorToast(null)}
            className="text-rose-300 text-xs hover:underline cursor-pointer font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Seating Layout Section */}
      <div className="bg-[#12141d] border border-neutral-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#d4af37]" />
              <h2 className="text-lg font-bold text-white tracking-wide">
                Restaurant Seating Layout
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
                Selected: <strong className="text-[#d4af37]">{currentLocation}</strong>
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Select any table to punch orders, fire rounds, shift tables, or void items.
            </p>
          </div>

          {/* Table Status Filters */}
          <div className="flex items-center gap-1.5 bg-[#1a1d29] p-1 rounded-xl border border-neutral-800 text-xs font-semibold">
            <button
              onClick={() => setTableFilter('all')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                tableFilter === 'all'
                  ? 'bg-[#9f1119] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All ({tables.length})
            </button>
            <button
              onClick={() => setTableFilter('vacant')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                tableFilter === 'vacant'
                  ? 'bg-[#9f1119] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Vacant ({tables.filter((t) => !activeOrdersMap.has(t.name)).length})
            </button>
            <button
              onClick={() => setTableFilter('occupied')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                tableFilter === 'occupied'
                  ? 'bg-[#9f1119] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Occupied ({tables.filter((t) => activeOrdersMap.has(t.name)).length})
            </button>
          </div>
        </div>

        {/* 9 Regular Dining Tables Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
          {tables
            .filter((t) => t.type === 'regular')
            .filter((t) => {
              const isOccupied = activeOrdersMap.has(t.name);
              if (tableFilter === 'vacant') return !isOccupied;
              if (tableFilter === 'occupied') return isOccupied;
              return true;
            })
            .map((t) => {
              const isSelected = currentLocation === t.name;
              const activeOrder = activeOrdersMap.get(t.name);
              const runningTotal = activeOrder
                ? activeOrder.items
                    .filter((it) => !it.isVoided)
                    .reduce((s, it) => s + it.price * it.qty, 0)
                : 0;

              return (
                <button
                  key={t.id || t.name}
                  onClick={() => handleSelectTable(t.name)}
                  className={`p-3.5 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-between min-h-[72px] ${
                    isSelected
                      ? 'bg-[#9f1119] border-[#d4af37] text-white shadow-lg shadow-[#9f1119]/40 ring-2 ring-[#d4af37]/60'
                      : activeOrder
                      ? 'bg-[#211a12] border-amber-500/50 text-white hover:border-amber-400'
                      : 'bg-[#171924] border-neutral-800 text-neutral-300 hover:bg-[#1e2130] hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-sm">{t.name}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected
                          ? 'bg-white'
                          : activeOrder
                          ? 'bg-amber-400 ring-2 ring-amber-400/30'
                          : 'bg-emerald-500/70'
                      }`}
                    />
                  </div>

                  <div className="mt-2 text-xs font-mono">
                    {activeOrder ? (
                      <span className="font-bold text-[#d4af37]">{formatINR(runningTotal)}</span>
                    ) : (
                      <span className="text-neutral-500 text-[11px]">Free</span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>

        {/* 2 Private Spaces: VIP Lounge & Couple Cabin */}
        <div className="mt-4 pt-4 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* VIP Lounge */}
          <div
            onClick={() => handleSelectTable('VIP Lounge')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
              currentLocation === 'VIP Lounge'
                ? 'bg-[#9f1119] border-[#d4af37] text-white shadow-lg ring-2 ring-[#d4af37]'
                : activeOrdersMap.has('VIP Lounge')
                ? 'bg-[#211a12] border-amber-500/60 text-white'
                : 'bg-[#171924] border-neutral-800 text-neutral-300 hover:bg-[#1e2130]'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white">VIP Lounge</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-black/50 text-[#d4af37] border border-[#d4af37]/30">
                  2nd Floor
                </span>
                {activeOrdersMap.has('VIP Lounge') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700">
                    Occupied
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                Hourly billing space · Luxury shisha sofa setup
              </div>
            </div>

            <div className="text-right">
              {activeOrdersMap.has('VIP Lounge') ? (
                <span className="text-sm font-mono font-bold text-[#d4af37]">
                  {formatINR(
                    activeOrdersMap
                      .get('VIP Lounge')
                      ?.items.filter((it) => !it.isVoided)
                      .reduce((s, it) => s + it.price * it.qty, 0)
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGoToBooking('VIP Lounge');
                  }}
                  className="px-3 py-1.5 bg-[#d4af37] hover:bg-[#e5c158] text-black font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Book Space
                </button>
              )}
            </div>
          </div>

          {/* Couple Cabin */}
          <div
            onClick={() => handleSelectTable('Couple Cabin')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
              currentLocation === 'Couple Cabin'
                ? 'bg-[#9f1119] border-[#d4af37] text-white shadow-lg ring-2 ring-[#d4af37]'
                : activeOrdersMap.has('Couple Cabin')
                ? 'bg-[#211a12] border-amber-500/60 text-white'
                : 'bg-[#171924] border-neutral-800 text-neutral-300 hover:bg-[#1e2130]'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white">Couple Cabin</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-black/50 text-[#d4af37] border border-[#d4af37]/30">
                  1st Floor
                </span>
                {activeOrdersMap.has('Couple Cabin') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700">
                    Occupied
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                Hourly billing space · Private romantic cabin
              </div>
            </div>

            <div className="text-right">
              {activeOrdersMap.has('Couple Cabin') ? (
                <span className="text-sm font-mono font-bold text-[#d4af37]">
                  {formatINR(
                    activeOrdersMap
                      .get('Couple Cabin')
                      ?.items.filter((it) => !it.isVoided)
                      .reduce((s, it) => s + it.price * it.qty, 0)
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGoToBooking('Couple Cabin');
                  }}
                  className="px-3 py-1.5 bg-[#d4af37] hover:bg-[#e5c158] text-black font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Book Space
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVE TABLE ACTION & AUDIT BAR (Edge Case Toolbar) */}
      {currentActiveOrder && (
        <div className="p-4 bg-gradient-to-r from-[#1e1814] to-[#141622] border border-amber-500/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl animate-fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider">
                Ongoing Table Bill
              </span>
              <span className="text-sm font-extrabold text-white">
                Order #{currentActiveOrder.orderNumber || currentActiveOrder.id}
              </span>
              <span className="text-xs text-neutral-400">· Server: {currentActiveOrder.staff}</span>
            </div>
            <div className="text-xs text-neutral-300 flex items-center gap-3">
              <span>
                Active Items: <strong>{runningActiveItems.length}</strong>
              </span>
              <span>·</span>
              <span>
                Running Subtotal: <strong className="text-[#d4af37] font-mono text-sm">{formatINR(runningSubtotal)}</strong>
              </span>
              {runningVoidedItems.length > 0 && (
                <>
                  <span>·</span>
                  <span className="text-rose-400 font-semibold">
                    {runningVoidedItems.length} Voided
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Table Shift Button */}
            <button
              onClick={() => {
                setTargetTable(vacantTables[0]?.name || '');
                setIsTransferModalOpen(true);
              }}
              className="px-3 py-2 bg-[#25293c] hover:bg-[#323750] text-amber-300 hover:text-white border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
              <span>Shift Table</span>
            </button>

            {/* Merge Table Button */}
            <button
              onClick={() => {
                setMergeTargetTable(occupiedMergeTables[0]?.name || '');
                setIsMergeModalOpen(true);
              }}
              className="px-3 py-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <GitMerge className="w-3.5 h-3.5 text-indigo-400" />
              <span>Merge Table</span>
            </button>

            {/* Cancel Order / Walkout Button */}
            <button
              onClick={() => setIsVoidOrderModalOpen(true)}
              className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-600/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <Ban className="w-3.5 h-3.5 text-rose-400" />
              <span>Void Order / Walkout</span>
            </button>

            {/* Quick Settle Bill Button */}
            {onGoToBilling && auth.can('bill.settle') && (
              <button
                onClick={() => onGoToBilling(currentActiveOrder.id)}
                className="px-3.5 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-600 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
              >
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                <span>Go to Checkout</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Guest & Server Bar */}
      <div className="bg-[#12141d] border border-neutral-800 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-neutral-300 mb-1">
              Guest Name (Optional)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Guest name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-white font-medium focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 mb-1">
              Contact Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="tel"
                placeholder="Mobile number"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 mb-1">
              Captain / Server
            </label>
            {/* Orders are recorded under the signed-in staff member */}
            <div className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-800 rounded-lg text-white font-medium truncate">
              {staff || signedInName}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 mb-1">
              Link Private Booking
            </label>
            <select
              value={linkedBookingId}
              onChange={(e) => setLinkedBookingId(e.target.value)}
              className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-white font-medium focus:outline-none focus:border-[#d4af37]"
            >
              <option value="">None / Regular Table</option>
              {bookings
                .filter((b) => b.status === 'ACTIVE')
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} · {b.venue} ({b.guest})
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Split: Menu Catalog (Left) & Active Order Docket + Running Items (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Menu & Categories (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search, Category & 86 Toggle Bar */}
          <div className="bg-[#12141d] border border-neutral-800 rounded-xl p-4 space-y-3 shadow-md">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search food, mojito, shisha, chilli, noodles, rolls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#1a1d29] border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* 86 Manager Mode Button */}
              <button
                type="button"
                onClick={() => setIs86ManagerMode((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-all shrink-0 ${
                  is86ManagerMode
                    ? 'bg-rose-950 border-rose-500 text-rose-200 ring-2 ring-rose-500/40 animate-pulse'
                    : 'bg-[#1a1d29] border-neutral-700 text-neutral-400 hover:text-white'
                }`}
                title="Toggle 86 Out of Stock mode for rapid menu updates"
              >
                <Ban className={`w-3.5 h-3.5 ${is86ManagerMode ? 'text-rose-400' : 'text-neutral-500'}`} />
                <span>{is86ManagerMode ? '86 Mode Active' : '86 Stock Mode'}</span>
              </button>
            </div>

            {/* Category horizontal scrolling bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer font-bold transition-colors ${
                    activeCategory === cat
                      ? 'bg-[#9f1119] text-white shadow-sm'
                      : 'bg-[#1a1d29] text-neutral-300 hover:bg-[#252a3b] border border-neutral-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Quick 1-tap add-on buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80 overflow-x-auto text-[11px] scrollbar-none">
              <span className="text-neutral-400 flex items-center gap-1 font-semibold whitespace-nowrap">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Quick Shisha Extras:
              </span>
              {quickAddons.map((addon) => (
                <button
                  key={addon.id}
                  onClick={() => addToCart(addon)}
                  className="px-2.5 py-1 bg-[#1a1d29] hover:bg-[#282d40] text-neutral-200 border border-neutral-700 rounded-md whitespace-nowrap cursor-pointer transition-colors"
                >
                  + {addon.name} ({formatINR(addon.price)})
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[640px] overflow-y-auto pr-1">
            {filteredMenu.map((item) => {
              const inCartItem = cart.find((x) => x.id === item.id);
              const is86 = !item.isAvailable;

              return (
                <div
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden ${
                    is86
                      ? 'bg-[#161314] border-rose-900/40 opacity-75'
                      : inCartItem
                      ? 'bg-[#20171a] border-[#9f1119] shadow-md shadow-[#9f1119]/20'
                      : 'bg-[#141620] border-neutral-800 hover:border-[#d4af37]/60 hover:bg-[#1a1d2a]'
                  }`}
                >
                  {/* Out of Stock 86 Badge Overlay */}
                  {is86 && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-rose-900/90 border border-rose-700 text-rose-200 text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <Ban className="w-2.5 h-2.5" />
                      <span>86 SOLD OUT</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-start justify-between gap-1.5 pr-14">
                      <span className={`text-sm font-bold leading-snug ${is86 ? 'line-through text-neutral-400' : 'text-white'}`}>
                        {item.name}
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1.5">
                      <span>{item.category}</span>
                      <span>·</span>
                      <span className="font-semibold text-neutral-300">{item.station}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                    <span className="text-base font-mono font-extrabold text-[#d4af37]">
                      {formatINR(item.price)}
                    </span>

                    {is86ManagerMode ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggle86(item);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                          is86
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {is86 ? 'Mark Available' : '86 Item'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={is86}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(item);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                          is86
                            ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                            : inCartItem
                            ? 'bg-[#9f1119] text-white shadow-sm'
                            : 'bg-[#212536] hover:bg-[#9f1119] text-neutral-200 hover:text-white'
                        }`}
                      >
                        {inCartItem ? (
                          <>
                            <span>{inCartItem.qty} in cart</span>
                            <Plus className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>Add</span>
                            <Plus className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Active Order Docket & Running Rounds (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Running Items on Table (If occupied) */}
          {currentActiveOrder && (
            <div className="bg-[#12141d] border border-amber-500/30 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold text-white">
                    Punched Rounds ({currentActiveOrder.items.length})
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-[#d4af37]">
                  Running: {formatINR(runningSubtotal)}
                </span>
              </div>

              {/* Running Items List with VOID Option */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {currentActiveOrder.items.map((item, index) => (
                  <div
                    key={index}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      item.isVoided
                        ? 'bg-rose-950/20 border-rose-900/40 text-neutral-500'
                        : 'bg-[#171924] border-neutral-800 text-neutral-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${item.isVoided ? 'line-through text-rose-400' : 'text-white'}`}>
                          {item.qty}x {item.name}
                        </span>
                        {item.isVoided && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                            VOIDED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {item.station} · {formatINR(item.price * item.qty)}
                        {item.isVoided && item.voidReason && (
                          <span className="ml-1 text-rose-300 italic">({item.voidReason})</span>
                        )}
                      </div>
                    </div>

                    {!item.isVoided && (
                      <button
                        onClick={() => {
                          setSelectedVoidItemIndex(index);
                          setSelectedVoidItem(item);
                          setIsVoidModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/80 rounded-lg text-[11px] font-bold cursor-pointer transition-colors shrink-0"
                      >
                        Void
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Cart Draft (Order Docket to Fire) */}
          <div className="bg-[#12141d] border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">New Docket Round</h3>
                  <span className="px-2.5 py-1 rounded-md bg-[#9f1119] text-white text-xs font-bold font-mono shadow-sm">
                    {currentLocation}
                  </span>
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  {cartItemCount} item(s) to fire to stations
                </div>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-neutral-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Draft</span>
                </button>
              )}
            </div>

            {/* Cart Item Rows */}
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="p-8 text-center bg-[#171924]/60 border border-neutral-800 rounded-xl">
                  <ChefHat className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
                  <div className="text-sm font-bold text-neutral-200">Docket is empty</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Tap items from the left menu to add new round.
                  </div>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#171924] border border-neutral-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm truncate">{item.name}</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {item.station} · {formatINR(item.price)} each
                      </div>
                    </div>

                    {/* Quantity keypad touch buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-8 h-8 rounded-lg bg-[#222638] hover:bg-[#2e334c] text-white flex items-center justify-center cursor-pointer transition-colors font-bold"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-mono font-bold text-base text-white">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-8 h-8 rounded-lg bg-[#222638] hover:bg-[#2e334c] text-white flex items-center justify-center cursor-pointer transition-colors font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 rounded-lg text-neutral-500 hover:text-rose-400 flex items-center justify-center cursor-pointer ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-18 text-right font-mono font-bold text-sm text-neutral-100 shrink-0">
                      {formatINR(item.price * item.qty)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick 1-Tap Cooking Notes Chips */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Quick 1-Tap Cooking Instructions:
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_NOTES.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddQuickNote(chip)}
                    className="px-2.5 py-1 bg-[#1c202e] hover:bg-[#282f45] text-neutral-300 hover:text-white border border-neutral-700/60 rounded-md text-[11px] font-medium cursor-pointer transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              {/* Special Preparation / Flavour Notes Textarea */}
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Flavour mix (e.g. Afzal Paan + Brain Freezer, Milk Base, spicy fries...)"
                className="w-full p-2.5 bg-[#171924] border border-neutral-700/80 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            {/* Shisha Timer & Advance Box */}
            <div className="p-3.5 bg-[#171924] border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-neutral-200 font-bold">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Shisha Pot Duration:
                </span>
                <div className="flex items-center gap-1">
                  {[45, 60, 90].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setShishaDuration(dur)}
                      className={`px-3 py-1 rounded-md text-xs font-mono font-bold cursor-pointer transition-colors ${
                        shishaDuration === dur
                          ? 'bg-[#d4af37] text-black shadow-sm'
                          : 'bg-[#222638] text-neutral-300 hover:bg-[#2b3046]'
                      }`}
                    >
                      {dur}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                <label className="text-neutral-300 font-semibold">Shisha Advance (₹):</label>
                <input
                  type="number"
                  min="0"
                  value={shishaAdvance}
                  onChange={(e) => setShishaAdvance(Number(e.target.value))}
                  className="w-28 px-2.5 py-1.5 bg-[#0e1017] border border-neutral-700 rounded-lg text-right text-xs text-[#d4af37] font-mono font-bold focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            {/* Action Total */}
            <div className="pt-3 border-t border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                  New Round Subtotal:
                </span>
                <span className="text-2xl font-mono font-extrabold text-[#d4af37]">
                  {formatINR(cartSubtotal)}
                </span>
              </div>

              <button
                onClick={handleOrderSubmit}
                disabled={cart.length === 0 || isSubmitting}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  cart.length > 0
                    ? 'bg-[#9f1119] hover:bg-[#b91c1c] text-white shadow-xl shadow-[#9f1119]/30 active:scale-[0.99]'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Sending to kitchen…' : 'Punch Docket & Fire Station KOTs'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE TRANSFER / SHIFT MODAL */}
      {isTransferModalOpen && currentActiveOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#141622] border border-amber-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Shift / Transfer Table</h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Current Table:</span>
                <span className="font-extrabold text-white">{currentLocation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Order ID:</span>
                <span className="font-mono text-[#d4af37] font-bold">
                  {currentActiveOrder.orderNumber || currentActiveOrder.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Active Balance:</span>
                <span className="font-mono font-bold text-emerald-400">{formatINR(runningSubtotal)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Destination Vacant Table:
              </label>
              {vacantTables.length === 0 ? (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs text-center font-medium">
                  No other tables are currently vacant!
                </div>
              ) : (
                <select
                  value={targetTable}
                  onChange={(e) => setTargetTable(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#1b1e2a] border border-neutral-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-[#d4af37]"
                >
                  {vacantTables.map((t) => (
                    <option key={t.id || t.name} value={t.name}>
                      {t.name} ({t.floor} - {t.capacity} Seats)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Reason for Table Shift:
              </label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g. Guest requested AC section, Joined friends, upstairs shift"
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTransferring || vacantTables.length === 0}
                onClick={handleExecuteTransfer}
                className="px-4 py-2 bg-[#9f1119] hover:bg-[#b91c1c] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isTransferring ? 'Transferring...' : 'Confirm Table Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE MERGE MODAL */}
      {isMergeModalOpen && currentActiveOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#141622] border border-indigo-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Merge Tables & Combine Bills</h3>
              </div>
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Transfer all active items, payments, and open KOTs from <strong className="text-white">{currentLocation}</strong> into another occupied table. <strong className="text-amber-400">{currentLocation}</strong> will be vacated.
            </p>

            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Source Table (Closing):</span>
                <span className="font-extrabold text-white">{currentLocation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Items to Merge:</span>
                <span className="font-bold text-indigo-300">{currentActiveOrder.items.length} Items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Amount to Transfer:</span>
                <span className="font-mono font-bold text-emerald-400">{formatINR(runningSubtotal)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Merge Into Occupied Target Table:
              </label>
              {occupiedMergeTables.length === 0 ? (
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 text-xs text-center">
                  No other occupied tables currently running!
                </div>
              ) : (
                <select
                  value={mergeTargetTable}
                  onChange={(e) => setMergeTargetTable(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#1b1e2a] border border-neutral-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-indigo-400"
                >
                  {occupiedMergeTables.map((t) => (
                    <option key={t.id || t.name} value={t.name}>
                      {t.name} ({t.floor})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMerging || occupiedMergeTables.length === 0}
                onClick={handleExecuteMerge}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isMerging ? 'Merging...' : 'Confirm Table Merge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID ENTIRE ORDER / EMERGENCY WALKOUT MODAL */}
      {isVoidOrderModalOpen && currentActiveOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#141622] border border-rose-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-white">Cancel Order / Emergency Walkout</h3>
              </div>
              <button
                onClick={() => setIsVoidOrderModalOpen(false)}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-200">
              ⚠️ <strong>Warning:</strong> This will cancel all active kitchen/bar/shisha KOTs for Table <strong>{currentLocation}</strong>, mark the order VOIDED with an audit record, and immediately release the table to <strong>VACANT</strong>.
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Cancellation Reason:
              </label>
              <select
                value={voidOrderReason}
                onChange={(e) => setVoidOrderReason(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#1b1e2a] border border-neutral-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-400"
              >
                <option value="Guest Walkout / Emergency">Guest Walkout / Left without notice</option>
                <option value="Accidental Order Creation">Accidental Order Creation</option>
                <option value="Customer Dissatisfaction / Food Returned">Customer Dissatisfaction / Returned</option>
                <option value="VIP Space Booking Cancelled">VIP Space Booking Cancelled</option>
                <option value="Manager Special Void">Manager Special Void</option>
              </select>
            </div>

            {!canVoid && (
              <div>
                <label className="block text-sm font-semibold text-neutral-300 mb-1.5">
                  Manager PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="off"
                  value={voidOrderPin}
                  onChange={(e) => setVoidOrderPin(e.target.value)}
                  placeholder="Manager enters PIN"
                  className="w-full h-12 px-3 bg-[#1b1e2a] border border-neutral-700 rounded-xl text-white text-base tracking-widest font-mono text-center focus:outline-none focus:border-rose-400"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsVoidOrderModalOpen(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Keep Order Active
              </button>
              <button
                type="button"
                disabled={isVoidingEntireOrder}
                onClick={handleExecuteVoidEntireOrder}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isVoidingEntireOrder ? 'Voiding...' : 'Confirm Full Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEM VOID AUTHORIZATION MODAL */}
      {isVoidModalOpen && selectedVoidItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#141622] border border-rose-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Supervisor Void Authorization</h3>
              </div>
              <button
                onClick={() => setIsVoidModalOpen(false)}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Target Item:</span>
                <span className="font-extrabold text-white">
                  {selectedVoidItem.qty}x {selectedVoidItem.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Station Docket:</span>
                <span className="font-bold text-amber-300">{selectedVoidItem.station}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Deduction:</span>
                <span className="font-mono font-bold text-rose-400">
                  - {formatINR(selectedVoidItem.price * selectedVoidItem.qty)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Mandatory Void Reason:
              </label>
              <select
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#1b1e2a] border border-neutral-700 rounded-xl text-white font-medium text-xs focus:outline-none focus:border-[#d4af37]"
              >
                {VOID_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {!canVoid && (
              <div>
                <label className="text-sm font-semibold text-neutral-300 flex items-center gap-1.5 mb-1.5">
                  <Lock className="w-4 h-4 text-neutral-400" />
                  Manager PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="off"
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  placeholder="Manager enters PIN"
                  className="w-full h-12 px-3 bg-[#1b1e2a] border border-neutral-700 rounded-xl text-white font-mono text-center tracking-widest text-base focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVoiding}
                onClick={handleExecuteVoid}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isVoiding ? 'Voiding...' : 'Authorize & Generate Void Docket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
