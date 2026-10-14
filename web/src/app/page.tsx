'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  MenuItem,
  TableInfo,
  Order,
  PrivateBooking,
  KOT,
  AppSettings,
  CartItem,
  BillBooking,
} from '@/types/pos';
import { POSOrderView } from '@/components/POSOrderView';
import { KOTLogView } from '@/components/KOTLogView';
import { requestPrint } from '@/lib/print/printer';
import { PrinterStatus } from '@/components/print/PrinterStatus';
import { ShishaTimerView } from '@/components/ShishaTimerView';
import { LiveOrdersView } from '@/components/LiveOrdersView';
import { PrivateBookingsView } from '@/components/PrivateBookingsView';
import { BillingView } from '@/components/BillingView';
import { ShiftRegisterView } from '@/components/ShiftRegisterView';
import { SettingsView } from '@/components/SettingsView';
import { TopBar } from '@/components/TopBar';
import { NavTabs, WebTabKey, allowedTabs } from '@/components/NavTabs';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { TeamView } from '@/components/auth/TeamView';
import { playOrderChime } from '@/utils/audio';

const DEFAULT_SETTINGS: AppSettings = {
  loungeName: 'LAYALI SHISHA LOUNGE',
  tagline: 'PREMIUM LOUNGE & CAFE',
  address: 'Rooftop & 1st/2nd Floor, Main Boulevard',
  phone: '+91 98765 43210',
  gstNumber: '20AAAAA0000A1Z5',
  taxPercent: 5,
  soundAlerts: true,
  shishaDefaultDuration: 45,
};

/** API order → screen model */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(o: any): Order {
  return {
    id: o._id || o.orderNumber,
    orderNumber: o.orderNumber,
    invoiceNumber: o.invoiceNumber,
    location: o.tableName,
    guest: o.guestName || '',
    phone: o.guestPhone || '',
    staff: o.staffName || '',
    bookingId: o.bookingId || null,
    items: o.items || [],
    notes: o.notes || '',
    shishaAdvance: o.shishaAdvance || 0,
    duration: o.duration || 45,
    created: o.createdAt || new Date().toISOString(),
    closedAt: o.closedAt,
    payments: o.payments || [],
    closed: o.closed || false,
    taxPercent: o.taxPercent ?? 5,
    discountAmount: o.discountAmount || 0,
    discountReason: o.discountReason,
  };
}

/** How often screens check for changes made on other devices */
const SYNC_INTERVAL_MS = 4000;

export default function POSHomePage() {
  return (
    <AuthProvider>
      <POSApp />
    </AuthProvider>
  );
}

function POSApp() {
  const auth = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'connecting' | 'fallback'>('connecting');
  const [dbMessage, setDbMessage] = useState<string>('Connecting to MongoDB Atlas...');
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<PrivateBooking[]>([]);
  const [kots, setKots] = useState<KOT[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  // Read inside the data loader without re-creating it
  const soundRef = useRef(settings.soundAlerts);
  const knownKotIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    soundRef.current = settings.soundAlerts;
  }, [settings.soundAlerts]);

  const visibleTabs = useMemo(() => allowedTabs(auth.permissions), [auth.permissions]);
  const [selectedTab, setActiveTab] = useState<WebTabKey>('order');
  const activeTab: WebTabKey = visibleTabs.includes(selectedTab) ? selectedTab : visibleTabs[0];

  const [currentLocation, setCurrentLocation] = useState<string>('Table 1');
  const [selectedBillingOrderId, setSelectedBillingOrderId] = useState<string>('');


  const [currentTime, setCurrentTime] = useState<string>('');

  // Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial data from backend API
  const refreshAllData = useCallback(async () => {
    try {
      setDbStatus('connecting');
      // Initialize DB & auto-seed check
      const initRes = await fetch('/api/v1/init');
      const initData = await initRes.json();

      if (!initData.success) {
        setDbStatus('fallback');
        setDbMessage(initData.error || 'Atlas connecting error');
      } else {
        setDbStatus('connected');
        setDbMessage('MongoDB Atlas Connected');
      }

      // Fetch tables
      const tablesRes = await fetch('/api/v1/tables');
      const tablesJson = await tablesRes.json();
      if (tablesJson.success && tablesJson.data) {
        setTables(
          tablesJson.data.map((t: any) => ({
            id: t._id || t.name,
            name: t.name,
            floor: t.floor,
            type: t.type,
            capacity: t.capacity,
            status: t.status,
            currentOrderId: t.currentOrderId,
            hourlyRate: t.hourlyRate,
          }))
        );
      }

      // Fetch menu
      const menuRes = await fetch('/api/v1/menu');
      const menuJson = await menuRes.json();
      if (menuJson.success && menuJson.data) {
        setMenu(
          menuJson.data.map((m: any) => ({
            id: m._id || m.id,
            name: m.name,
            price: m.price,
            station: m.station,
            category: m.category,
            isAvailable: m.isAvailable,
          }))
        );
      }

      // Fetch orders
      const ordersRes = await fetch('/api/v1/orders?status=recent');
      const ordersJson = await ordersRes.json();
      if (ordersJson.success && ordersJson.data) {
        setOrders(ordersJson.data.map(mapOrder));
      }

      // Fetch KOTs
      const kotsRes = await fetch('/api/v1/kots?status=RECENT');
      const kotsJson = await kotsRes.json();
      if (kotsJson.success && kotsJson.data) {
        // Chime when tickets punched elsewhere (phones, other counters) arrive
        const ids = new Set<string>(kotsJson.data.map((k: any) => String(k.kotNumber || k._id)));
        const known = knownKotIdsRef.current;
        if (known && soundRef.current && [...ids].some((id) => !known.has(id) && id.startsWith('KOT-'))) playOrderChime();
        knownKotIdsRef.current = ids;
        setKots(
          kotsJson.data.map((k: any) => ({
            id: k.kotNumber || k._id,
            kotNumber: k.kotNumber,
            orderId: k.orderNumber || k.orderId,
            location: k.tableName,
            guest: k.guestName || '',
            station: k.station,
            items: k.items || [],
            notes: k.notes || '',
            duration: k.duration,
            status: k.status,
            created: k.createdAt || new Date().toISOString(),
          }))
        );
      }

      // Fetch Bookings
      const bookingsRes = await fetch('/api/v1/bookings');
      const bookingsJson = await bookingsRes.json();
      if (bookingsJson.success && bookingsJson.data) {
        setBookings(
          bookingsJson.data.map((b: any) => ({
            id: b.bookingNumber || b._id,
            bookingNumber: b.bookingNumber,
            venue: b.venue,
            guest: b.guest,
            phone: b.phone,
            rate: b.rate,
            advance: b.advance,
            hours: b.hours,
            start: b.start || b.createdAt,
            status: b.status,
            notes: b.notes,
          }))
        );
      }

      // Lounge details printed on bills
      const settingsRes = await fetch('/api/v1/settings');
      const settingsJson = await settingsRes.json();
      if (settingsJson.success && settingsJson.data) {
        setSettings((prev) => ({ ...prev, ...settingsJson.data, soundAlerts: prev.soundAlerts }));
      }
    } catch (err: any) {
      console.warn('Backend fetch error, continuing gracefully:', err);
      setDbStatus('fallback');
      setDbMessage('Backend Connecting');
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Live updates: a tiny version check every few seconds (works on serverless hosting such as Vercel);
  // the full data reloads only when something changed. Paused while the tab is hidden.
  useEffect(() => {
    let lastVersion: number | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch('/api/v1/sync');
          const json = await res.json();
          if (json.success) {
            if (lastVersion !== null && json.data.version !== lastVersion) await refreshAllData();
            lastVersion = json.data.version;
          }
        } catch {
          // Offline for a moment: try again on the next tick
        }
      }
      if (!stopped) timer = setTimeout(tick, SYNC_INTERVAL_MS);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [refreshAllData]);

  // Order submission
  const handleOrderSubmit = async (orderData: {
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
  }) => {
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: orderData.location,
          guestName: orderData.guest,
          guestPhone: orderData.phone,
          bookingId: orderData.bookingId,
          items: orderData.items,
          notes: orderData.notes,
          shishaAdvance: orderData.shishaAdvance,
          duration: orderData.duration,
          taxPercent: settings.taxPercent,
          idempotencyKey: orderData.idempotencyKey,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        // 401 is handled by the auth gate (back to the PIN lock); the cart is kept for the retry
        if (res.status !== 401) alert(json.error || 'Failed to submit order');
        return false;
      }
      // The server queues one KOT slip per station for the counter printer
      if (settings.soundAlerts) playOrderChime();
      await refreshAllData();
      setActiveTab('live');
      return true;
    } catch {
      alert('Cannot reach the server. The order was not sent — please try again.');
      return false;
    }
  };

  // Shisha timer extensions
  const handleShishaAddDuration = async (kotId: string, additionalMinutes: number) => {
    try {
      await fetch('/api/v1/shisha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kotId, addMinutes: additionalMinutes }),
      });
      await refreshAllData();
    } catch {
      // ignore
    }
  };

  const handleShishaMarkServed = async (kotId: string) => {
    try {
      await fetch('/api/v1/shisha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kotId, markServed: true }),
      });
      await refreshAllData();
    } catch {
      // ignore
    }
  };

  // Private bookings
  const handleCreateBooking = async (
    bookingData: Omit<PrivateBooking, 'id' | 'start' | 'status'>
  ) => {
    try {
      const res = await fetch('/api/v1/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });
      const json = await res.json();
      if (json.success) {
        await refreshAllData();
        setCurrentLocation(bookingData.venue);
        setActiveTab('order');
      }
    } catch {
      // ignore
    }
  };

  const handleCloseBooking = async (bookingId: string) => {
    try {
      await fetch('/api/v1/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, status: 'CLOSED' }),
      });
      await refreshAllData();
    } catch {
      // ignore
    }
  };

  // Payment Recording & Bill Settlement
  const handleRecordPayment = async (
    orderId: string,
    payment: {
      amount: number;
      method: 'Cash' | 'UPI' | 'Card' | 'Credit Account';
      creditRef?: string;
    },
    options?: {
      discount?: number;
      discountReason?: string;
      taxPercent?: number;
      payments?: Array<{
        amount: number;
        method: 'Cash' | 'UPI' | 'Card' | 'Credit Account';
        creditRef?: string;
      }>;
      /** Room charge for the printed receipt */
      booking?: BillBooking;
    }
  ) => {
    const send = (approvalPin?: string) =>
      fetch('/api/v1/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          payment,
          payments: options?.payments,
          discount: options?.discount,
          discountReason: options?.discountReason,
          taxPercent: options?.taxPercent,
          closeOrder: true,
          approvalPin,
          booking: options?.booking,
        }),
      }).then(async (res) => ({ status: res.status, json: await res.json() }));

    try {
      let { status, json } = await send();
      if (status === 403 && json.error === 'Manager PIN required') {
        const pin = await auth.requestApproval('This discount is above the cashier limit');
        if (!pin) return false;
        ({ status, json } = await send(pin));
      }
      if (!json.success) {
        alert(json.error || 'Could not settle the bill');
        return false;
      }
      await refreshAllData();
      return true;
    } catch {
      alert('Cannot reach the server. The bill was not saved.');
      return false;
    }
  };

  // Counters
  const activeOrdersCount = useMemo(() => orders.filter((o) => !o.closed).length, [orders]);
  const activeKotsCount = useMemo(() => kots.filter((k) => k.status !== 'SERVED').length, [kots]);
  const activeShishaCount = useMemo(
    () => kots.filter((k) => k.station === 'Shisha Master' && k.status !== 'SERVED').length,
    [kots]
  );
  const activeBookingsCount = useMemo(
    () => bookings.filter((b) => b.status === 'ACTIVE').length,
    [bookings]
  );

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-100 flex flex-col selection:bg-[#9f1119] selection:text-white">
      <header className="no-print bg-[#10131a] border-b border-neutral-800/80 px-4 py-3 sticky top-0 z-40 shadow-lg">
        <div className="max-w-[1720px] mx-auto">
          <TopBar
            settings={settings}
            onToggleSound={() => setSettings((s) => ({ ...s, soundAlerts: !s.soundAlerts }))}
            dbStatus={dbStatus}
            dbMessage={dbMessage}
            currentTime={currentTime}
            onRefresh={refreshAllData}
            currentUser={auth.user}
            deviceName={auth.device?.name}
            onOpenAccount={auth.openAccount}
            onLock={auth.lock}
            printerStatus={<PrinterStatus isStation={!!auth.device?.printStation} />}
          />
          <NavTabs
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
            visibleTabs={visibleTabs}
            badges={{
              live: activeOrdersCount,
              kot: activeKotsCount,
              shisha: activeShishaCount,
              booking: activeBookingsCount,
            }}
          />
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-[1720px] mx-auto w-full p-4 md:p-6 flex-1 flex flex-col">
        {activeTab === 'order' && (
          <POSOrderView
            menu={menu}
            tables={tables}
            orders={orders}
            bookings={bookings}
            currentLocation={currentLocation}
            onSelectLocation={(loc) => setCurrentLocation(loc)}
            onSubmitOrder={handleOrderSubmit}
            onGoToBooking={(venue) => {
              setCurrentLocation(venue);
              setActiveTab('booking');
            }}
            onGoToBilling={(orderId) => {
              setSelectedBillingOrderId(orderId);
              setActiveTab('billing');
            }}
            onRefresh={refreshAllData}
          />
        )}

        {activeTab === 'kot' && <KOTLogView kots={kots} />}

        {activeTab === 'shisha' && (
          <ShishaTimerView
            kots={kots}
            orders={orders}
            onAddDuration={handleShishaAddDuration}
            onMarkServed={handleShishaMarkServed}
          />
        )}

        {activeTab === 'live' && (
          <LiveOrdersView
            orders={orders}
            bookings={bookings}
            onOpenBilling={(orderId) => {
              setSelectedBillingOrderId(orderId);
              setActiveTab('billing');
            }}
            onAddMoreItems={(location) => {
              setCurrentLocation(location);
              setActiveTab('order');
            }}
          />
        )}

        {activeTab === 'booking' && (
          <PrivateBookingsView
            bookings={bookings}
            onCreateBooking={handleCreateBooking}
            onCloseBooking={handleCloseBooking}
            onAttachOrder={(b) => {
              setCurrentLocation(b.venue);
              setActiveTab('order');
            }}
          />
        )}

        {activeTab === 'billing' && (
          <BillingView
            orders={orders}
            bookings={bookings}
            settings={settings}
            selectedOrderId={selectedBillingOrderId}
            onSelectOrderId={(id) => setSelectedBillingOrderId(id)}
            onRecordPayment={handleRecordPayment}
            onPrintReceipt={(order, booking) =>
              requestPrint({
                kind: 'bill',
                orderId: order.id,
                booking: booking ? { venue: booking.venue, rate: booking.rate, hours: booking.hours, advance: booking.advance } : undefined,
              })
            }
          />
        )}

        {activeTab === 'team' && <TeamView />}

        {activeTab === 'shifts' && (
          <ShiftRegisterView />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            menu={menu}
            onUpdateSettings={async (next) => {
              try {
                const res = await fetch('/api/v1/settings', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(next),
                });
                const json = await res.json();
                if (!json.success) return json.error || 'Could not save settings';
                setSettings((prev) => ({ ...prev, ...json.data, soundAlerts: next.soundAlerts }));
                return null;
              } catch {
                return 'Cannot reach the server. Settings were not saved.';
              }
            }}
            onMenuChanged={refreshAllData}
            onExportData={() => {
              const dump = JSON.stringify({ orders, kots, bookings, menu, settings });
              const blob = new Blob([dump], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `layali_backup_${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
            }}
          />
        )}
      </main>

    </div>
  );
}
