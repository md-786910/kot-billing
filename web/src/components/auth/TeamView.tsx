'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Monitor, Plus, Smartphone, Tv, UserPlus } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import type { UserRole } from '@/types/pos';
import { useAuth } from './AuthProvider';
import { api, Button, ErrorText, Field, Modal, SelectField } from './ui';

interface StaffRow {
  id: string;
  name: string;
  role: UserRole;
  phone: string;
  username: string;
  hasPassword: boolean;
  isActive: boolean;
  isLocked: boolean;
}

interface DeviceRow {
  id: string;
  name: string;
  type: 'TERMINAL' | 'MOBILE' | 'DISPLAY';
  station: string | null;
  lastSeenAt: string | null;
  isCurrent: boolean;
}

const ROLES = Object.keys(ROLE_LABELS) as UserRole[];
const DEVICE_LABELS = { TERMINAL: 'POS terminal', MOBILE: 'Waiter phone', DISPLAY: 'Station display' } as const;
const STATIONS = ['Kitchen', 'Beverage Counter', 'Shisha Master'];

/** Admin: staff accounts and paired devices. */
export function TeamView() {
  const { device: thisDevice, refresh: refreshAuth } = useAuth();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null);
  const [pairing, setPairing] = useState<'code' | 'this' | null>(null);

  const load = useCallback(async () => {
    const [s, d] = await Promise.all([api<StaffRow[]>('/api/v1/staff'), api<DeviceRow[]>('/api/v1/devices')]);
    if (!s.ok || !d.ok) return setError(s.error || d.error);
    setError('');
    setStaff(s.data);
    setDevices(d.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const patchStaff = async (id: string, body: Record<string, unknown>) => {
    const res = await api('/api/v1/staff', { method: 'PATCH', body: { id, ...body } });
    if (!res.ok) return setError(res.error);
    load();
  };

  const revokeDevice = async (d: DeviceRow) => {
    if (!confirm(`Revoke "${d.name}"? Anyone signed in on it is signed out and it must be paired again.`)) return;
    const res = await api('/api/v1/devices', { method: 'PATCH', body: { id: d.id, revoke: true } });
    if (!res.ok) return setError(res.error);
    if (d.isCurrent) await refreshAuth();
    load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <ErrorText>{error}</ErrorText>

      <section className="bg-[#12141e] border border-neutral-800 rounded-2xl">
        <header className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-white">Staff</h2>
            <p className="text-sm text-neutral-400">PIN for terminals and phones. Username + password for owner and managers.</p>
          </div>
          <Button onClick={() => setEditing('new')}><UserPlus className="w-4 h-4" /> Add staff</Button>
        </header>
        <ul className="divide-y divide-neutral-800">
          {staff.map((s) => (
            <li key={s.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${s.isActive ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-[180px]">
                <p className="text-base font-semibold text-white">{s.name}</p>
                <p className="text-sm text-neutral-400">
                  {ROLE_LABELS[s.role]}{s.username ? ` · @${s.username}` : ''}
                </p>
              </div>
              {s.isLocked && <Badge tone="rose">Locked</Badge>}
              {!s.isActive && <Badge tone="neutral">Inactive</Badge>}
              <div className="flex gap-2">
                {s.isLocked && <Button variant="secondary" onClick={() => patchStaff(s.id, { unlock: true })}>Unlock</Button>}
                <Button variant="secondary" onClick={() => setEditing(s)}>Edit</Button>
                <Button
                  variant={s.isActive ? 'ghost' : 'secondary'}
                  onClick={() => patchStaff(s.id, { isActive: !s.isActive })}
                >
                  {s.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-[#12141e] border border-neutral-800 rounded-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-white">Devices</h2>
            <p className="text-sm text-neutral-400">Only paired devices can use staff PIN sign-in.</p>
          </div>
          <div className="flex gap-2">
            {!thisDevice && <Button variant="secondary" onClick={() => setPairing('this')}><Monitor className="w-4 h-4" /> Pair this browser</Button>}
            <Button onClick={() => setPairing('code')}><Plus className="w-4 h-4" /> Pair a device</Button>
          </div>
        </header>
        {devices.length === 0 && <p className="p-4 text-sm text-neutral-400">No devices paired yet.</p>}
        <ul className="divide-y divide-neutral-800">
          {devices.map((d) => {
            const Icon = d.type === 'MOBILE' ? Smartphone : d.type === 'DISPLAY' ? Tv : Monitor;
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Icon className="w-5 h-5 text-[#d4af37] shrink-0" />
                <div className="flex-1 min-w-[180px]">
                  <p className="text-base font-semibold text-white">
                    {d.name} {d.isCurrent && <Badge tone="gold">This device</Badge>}
                  </p>
                  <p className="text-sm text-neutral-400">
                    {DEVICE_LABELS[d.type]}{d.station ? ` · ${d.station}` : ''} · {d.lastSeenAt ? `Last seen ${new Date(d.lastSeenAt).toLocaleString()}` : 'Not used yet'}
                  </p>
                </div>
                <Button variant="danger" onClick={() => revokeDevice(d)}>Revoke</Button>
              </li>
            );
          })}
        </ul>
      </section>

      {editing && (
        <StaffDialog
          staff={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {pairing && (
        <PairDialog
          mode={pairing}
          onClose={() => setPairing(null)}
          onPairedThis={async () => { setPairing(null); await refreshAuth(); load(); }}
          onCodeCreated={load}
        />
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: 'rose' | 'neutral' | 'gold'; children: React.ReactNode }) {
  const tones = {
    rose: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
    neutral: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    gold: 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/40',
  };
  return <span className={`inline-block align-middle ml-1 px-2 py-0.5 rounded-md border text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function StaffDialog({ staff, onClose, onSaved }: { staff: StaffRow | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !staff;
  const [form, setForm] = useState({
    name: staff?.name ?? '',
    role: staff?.role ?? ('CAPTAIN' as UserRole),
    phone: staff?.phone ?? '',
    pin: '',
    username: staff?.username ?? '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });
  const needsPassword = form.role === 'ADMIN' || form.role === 'MANAGER';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { name: form.name, role: form.role, phone: form.phone };
    if (isNew || form.pin) body.pin = form.pin;
    if (isNew) {
      if (form.username) Object.assign(body, { username: form.username, password: form.password });
    } else {
      if (form.username !== staff.username) body.username = form.username;
      if (form.password) body.password = form.password;
    }
    setBusy(true);
    const res = isNew
      ? await api('/api/v1/staff', { method: 'POST', body })
      : await api('/api/v1/staff', { method: 'PATCH', body: { id: staff.id, ...body } });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onSaved();
  };

  return (
    <Modal title={isNew ? 'Add staff' : `Edit ${staff.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name" value={form.name} onChange={set('name')} required />
        <SelectField label="Role" value={form.role} onChange={set('role')}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </SelectField>
        <Field label="Phone" value={form.phone} onChange={set('phone')} inputMode="tel" />
        <Field
          label={isNew ? 'PIN' : 'New PIN'}
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={form.pin}
          onChange={set('pin')}
          hint={isNew ? '4–6 digits. Tell the staff member privately.' : 'Leave empty to keep the current PIN'}
          autoComplete="off"
          required={isNew}
        />
        {(needsPassword || form.username) && (
          <div className="pt-2 border-t border-neutral-800 space-y-3">
            <p className="text-sm text-neutral-400">Password sign-in (for Admin and reports)</p>
            <Field label="Username" value={form.username} onChange={set('username')} autoCapitalize="none" autoComplete="off" />
            {form.username && (
              <Field
                label={isNew || !staff.hasPassword ? 'Password' : 'New password'}
                type="password"
                value={form.password}
                onChange={set('password')}
                autoComplete="new-password"
                hint={!isNew && staff.hasPassword ? 'Leave empty to keep the current password' : 'At least 8 characters'}
                required={isNew || !staff.hasPassword}
              />
            )}
          </div>
        )}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add staff' : 'Save changes'}</Button>
      </form>
    </Modal>
  );
}

function PairDialog({ mode, onClose, onPairedThis, onCodeCreated }: {
  mode: 'code' | 'this';
  onClose: () => void;
  onPairedThis: () => void;
  onCodeCreated: () => void;
}) {
  const [form, setForm] = useState({ name: '', type: mode === 'this' ? 'TERMINAL' : 'MOBILE', station: 'Kitchen' });
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await api<{ code: string; expiresAt: string }>('/api/v1/devices', {
      method: 'POST',
      body: { action: mode === 'this' ? 'register-this' : 'pairing-code', ...form },
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    if (mode === 'this') return onPairedThis();
    setCode(res.data);
    onCodeCreated();
  };

  if (code) {
    return (
      <Modal title="Pairing code" onClose={onClose}>
        <p className="text-sm text-neutral-400">
          On the new device, choose <span className="text-white">Have a pairing code?</span> (web) or open the waiter app, then enter:
        </p>
        <p className="my-5 text-center font-mono text-4xl font-bold tracking-[0.3em] text-[#d4af37]">{code.code}</p>
        <p className="text-sm text-neutral-500 text-center">Single use · expires at {new Date(code.expiresAt).toLocaleTimeString()}</p>
        <Button className="w-full mt-5" onClick={onClose}>Done</Button>
      </Modal>
    );
  }

  return (
    <Modal title={mode === 'this' ? 'Pair this browser' : 'Pair a device'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Device name" value={form.name} onChange={set('name')} placeholder={form.type === 'MOBILE' ? 'e.g. Captain phone 1' : 'e.g. Cashier desk'} required autoFocus />
        <SelectField label="Type" value={form.type} onChange={set('type')}>
          {Object.entries(DEVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
        {form.type === 'DISPLAY' && (
          <SelectField label="Station" value={form.station} onChange={set('station')}>
            {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectField>
        )}
        {form.type === 'DISPLAY' && (
          <p className="text-sm text-neutral-400">Displays show only their station&apos;s tickets and need no staff sign-in.</p>
        )}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'this' ? 'Pair this browser' : 'Get pairing code'}
        </Button>
      </form>
    </Modal>
  );
}
