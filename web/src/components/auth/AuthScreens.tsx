'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import type { UserRole } from '@/types/pos';
import { api, AuthShell, Button, ErrorText, Field, LinkButton, PinPad } from './ui';

/** First run: create the owner account (username + password for admin, PIN for terminals). */
export function SetupScreen({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '', pin: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    const res = await api('/api/v1/auth/setup', { method: 'POST', body: form });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone();
  };

  return (
    <AuthShell title="Set up Layali POS" subtitle="Create the owner account">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name" value={form.name} onChange={set('name')} autoComplete="name" required />
        <Field label="Username" value={form.username} onChange={set('username')} autoComplete="username" autoCapitalize="none" required />
        <Field label="Password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" hint="At least 8 characters" required />
        <Field label="Confirm password" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required />
        <Field label="Staff PIN" type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} value={form.pin} onChange={set('pin')} hint="4–6 digits, for quick sign-in on terminals" required />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Create owner account'}</Button>
      </form>
    </AuthShell>
  );
}

/** Unpaired browser: owner/manager password sign-in, or pair as a terminal / station display with a code. */
export function SignInScreen({ onDone, onBack, initialMode = 'password' }: {
  onDone: () => void;
  onBack?: () => void;
  initialMode?: 'password' | 'pair';
}) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = mode === 'password'
      ? await api('/api/v1/auth/login', { method: 'POST', body: { username, password } })
      : await api('/api/v1/devices/pair', { method: 'POST', body: { code } });
    setBusy(false);
    if (!res.ok) {
      setPassword('');
      return setError(res.error);
    }
    onDone();
  };

  const switchMode = (next: 'password' | 'pair') => {
    setMode(next);
    setError('');
  };

  return (
    <AuthShell
      title={mode === 'password' ? 'Sign in' : 'Pair this terminal'}
      subtitle={mode === 'password' ? 'Owner and manager access' : 'Enter the code from Admin → Devices'}
      footer={
        <div className="flex flex-col items-center">
          {mode === 'password'
            ? <LinkButton onClick={() => switchMode('pair')}>Have a pairing code?</LinkButton>
            : <LinkButton onClick={() => switchMode('password')}>Sign in with password</LinkButton>}
          {onBack && (
            <button onClick={onBack} className="mt-1 py-2 text-sm text-neutral-400 hover:text-white cursor-pointer inline-flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back to staff PIN
            </button>
          )}
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {mode === 'password' ? (
          <>
            <Field label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus required />
            <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </>
        ) : (
          <Field
            label="Pairing code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6 digits"
            autoFocus
            required
          />
        )}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'password' ? 'Sign in' : 'Pair terminal'}
        </Button>
      </form>
    </AuthShell>
  );
}

interface StaffOption {
  id: string;
  name: string;
  role: UserRole;
}

/** Paired terminal, nobody signed in: pick your name, enter your PIN. */
export function PinLockScreen({ deviceName, onDone, onPasswordSignIn }: {
  deviceName: string;
  onDone: () => void;
  onPasswordSignIn: () => void;
}) {
  const [staff, setStaff] = useState<StaffOption[] | null>(null);
  const [selected, setSelected] = useState<StaffOption | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<StaffOption[]>('/api/v1/auth/staff').then((res) => {
      if (res.ok) setStaff(res.data);
      else setError(res.error);
    });
  }, []);

  const submitPin = useCallback(async (pin: string) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    const res = await api('/api/v1/auth/pin', { method: 'POST', body: { userId: selected.id, pin } });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone();
  }, [selected, onDone]);

  const footer = (
    <div className="flex flex-col items-center">
      <LinkButton onClick={onPasswordSignIn}>Sign in with password</LinkButton>
      <p className="mt-1 text-xs text-neutral-500 inline-flex items-center gap-1.5"><Lock className="w-3 h-3" /> {deviceName}</p>
    </div>
  );

  if (!selected) {
    return (
      <AuthShell title="Who's working?" subtitle="Tap your name" footer={footer}>
        <ErrorText>{error}</ErrorText>
        {!staff && !error && <p className="text-sm text-neutral-400 text-center py-6">Loading…</p>}
        {staff?.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-6">No staff yet. Sign in with password and add staff in Admin.</p>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {staff?.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelected(s); setError(''); }}
              className="min-h-16 p-3 rounded-xl bg-[#1b1f2d] hover:bg-[#252b3d] border border-neutral-800 hover:border-[#d4af37]/50 text-left cursor-pointer"
            >
              <span className="block text-base font-semibold text-white truncate">{s.name}</span>
              <span className="block text-xs text-neutral-400 mt-0.5">{ROLE_LABELS[s.role]}</span>
            </button>
          ))}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={selected.name} subtitle="Enter your PIN" footer={footer}>
      <div className="space-y-4">
        <PinPad onSubmit={submitPin} busy={busy} />
        <ErrorText>{error}</ErrorText>
        <Button variant="ghost" className="w-full" onClick={() => { setSelected(null); setError(''); }}>
          <ArrowLeft className="w-4 h-4" /> Not you?
        </Button>
      </div>
    </AuthShell>
  );
}
