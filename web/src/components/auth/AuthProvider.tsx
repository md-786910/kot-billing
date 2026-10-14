'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Permission } from '@/lib/auth/permissions';
import type { UserRole } from '@/types/pos';
import { PinLockScreen, SetupScreen, SignInScreen } from './AuthScreens';
import { AccountDialog } from './AccountDialog';
import { PrintStation } from '@/components/print/PrintStation';
import { api, AuthShell, Button, Modal, PinPad } from './ui';

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface SessionDevice {
  id: string;
  name: string;
  type: 'TERMINAL' | 'MOBILE' | 'DISPLAY';
  station: 'Kitchen' | 'Beverage Counter' | 'Shisha Master' | null;
  /** This counter computer prints for every device */
  printStation: boolean;
}

interface MeResponse {
  setupRequired: boolean;
  user: SessionUser | null;
  device: SessionDevice | null;
  permissions: Permission[];
}

interface AuthApi {
  user: SessionUser | null;
  device: SessionDevice | null;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
  /** Sign the current user out; the terminal returns to its PIN lock. */
  lock: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Ask for a manager's PIN for an action the current user can't do alone. Resolves null if cancelled. */
  requestApproval: (reason: string) => Promise<string | null>;
  openAccount: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Lock idle sessions: paired terminals are shared, so they lock sooner
const IDLE_LOCK_MS = { terminal: 5 * 60_000, personal: 15 * 60_000 };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [approval, setApproval] = useState<{ reason: string; resolve: (pin: string | null) => void } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api<MeResponse>('/api/v1/auth/me');
    if (!res.ok) {
      setLoadError(res.error);
      return;
    }
    setLoadError('');
    setMe(res.data);
    if (res.data.user) setUsePassword(false);
  }, []);

  const lock = useCallback(async () => {
    await api('/api/v1/auth/logout', { method: 'POST' });
    setAccountOpen(false);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    // Initial session check on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Any API call rejected with 401 means the session ended elsewhere (revoked, expired): re-check.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args);
      const input = args[0];
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (res.status === 401 && url.includes('/api/v1/') && !url.includes('/api/v1/auth/')) {
        refreshRef.current();
      }
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Idle auto-lock for signed-in users
  const user = me?.user ?? null;
  const device = me?.device ?? null;
  useEffect(() => {
    if (!user) return;
    const limit = device ? IDLE_LOCK_MS.terminal : IDLE_LOCK_MS.personal;
    let timer = setTimeout(lock, limit);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, limit);
    };
    const events = ['pointerdown', 'keydown', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, device, lock]);

  const requestApproval = useCallback(
    (reason: string) => new Promise<string | null>((resolve) => setApproval({ reason, resolve })),
    []
  );

  const closeApproval = (pin: string | null) => {
    approval?.resolve(pin);
    setApproval(null);
  };

  if (loadError && !me) {
    return (
      <AuthShell title="Cannot connect" subtitle={loadError}>
        <Button className="w-full" onClick={refresh}>Try again</Button>
      </AuthShell>
    );
  }
  if (!me) return <div className="min-h-screen bg-[#0a0c10]" />;
  // The print station keeps printing for phones and other counters even while this screen is locked
  const station = me.device?.printStation ? <PrintStation /> : null;
  if (me.setupRequired) return <SetupScreen onDone={refresh} />;

  const signedIn = !!user || device?.type === 'DISPLAY';
  if (!signedIn) {
    if (device && !usePassword) {
      return (
        <>
          {station}
          <PinLockScreen deviceName={device.name} onDone={refresh} onPasswordSignIn={() => setUsePassword(true)} />
        </>
      );
    }
    return (
      <>
        {station}
        <SignInScreen onDone={refresh} onBack={device ? () => setUsePassword(false) : undefined} />
      </>
    );
  }

  const value: AuthApi = {
    user,
    device,
    permissions: me.permissions,
    can: (permission) => me.permissions.includes(permission),
    lock,
    refresh,
    requestApproval,
    openAccount: () => setAccountOpen(true),
  };

  return (
    <AuthContext.Provider value={value}>
      {station}
      {children}
      {approval && (
        <Modal title="Manager approval" onClose={() => closeApproval(null)}>
          <p className="text-sm text-neutral-400 mb-4">{approval.reason}. Ask a manager to enter their PIN.</p>
          <PinPad onSubmit={(pin) => closeApproval(pin)} />
        </Modal>
      )}
      {accountOpen && user && <AccountDialog user={user} onClose={() => setAccountOpen(false)} onLock={lock} />}
    </AuthContext.Provider>
  );
}
