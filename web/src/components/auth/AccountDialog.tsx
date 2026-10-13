'use client';

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import type { SessionUser } from './AuthProvider';
import { api, Button, ErrorText, Field, Modal } from './ui';

/** Signed-in user's own account: change PIN, change password (owner/manager), lock. */
export function AccountDialog({ user, onClose, onLock }: { user: SessionUser; onClose: () => void; onLock: () => void }) {
  const [section, setSection] = useState<'pin' | 'password'>('pin');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const canChangePassword = user.role === 'ADMIN' || user.role === 'MANAGER';

  const reset = (to: 'pin' | 'password') => {
    setSection(to);
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
    setDone('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone('');
    if (next !== confirm) return setError(section === 'pin' ? 'PINs do not match' : 'Passwords do not match');
    setBusy(true);
    const res = section === 'pin'
      ? await api('/api/v1/auth/change-pin', { method: 'POST', body: { currentPin: current, newPin: next } })
      : await api('/api/v1/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    reset(section);
    setDone(section === 'pin' ? 'PIN updated' : 'Password updated');
  };

  const pinProps = { type: 'password', inputMode: 'numeric' as const, maxLength: 6, autoComplete: 'off' };
  const passwordProps = { type: 'password' };

  return (
    <Modal title="My account" onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-base font-semibold text-white">{user.name}</p>
          <p className="text-sm text-neutral-400">{ROLE_LABELS[user.role]}</p>
        </div>
        <Button variant="secondary" onClick={onLock}><Lock className="w-4 h-4" /> Lock</Button>
      </div>

      {canChangePassword && (
        <div className="grid grid-cols-2 gap-1 p-1 mb-4 rounded-xl bg-[#0d0f15] border border-neutral-800">
          {(['pin', 'password'] as const).map((s) => (
            <button
              key={s}
              onClick={() => reset(s)}
              className={`h-10 rounded-lg text-sm font-semibold cursor-pointer ${section === s ? 'bg-[#9f1119] text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              {s === 'pin' ? 'Change PIN' : 'Change password'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <Field label={section === 'pin' ? 'Current PIN' : 'Current password'} value={current} onChange={(e) => setCurrent(e.target.value)} {...(section === 'pin' ? pinProps : passwordProps)} required />
        <Field label={section === 'pin' ? 'New PIN' : 'New password'} value={next} onChange={(e) => setNext(e.target.value)} hint={section === 'pin' ? '4–6 digits' : 'At least 8 characters'} {...(section === 'pin' ? pinProps : passwordProps)} required />
        <Field label="Confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} {...(section === 'pin' ? pinProps : passwordProps)} required />
        <ErrorText>{error}</ErrorText>
        {done && <p className="text-sm text-emerald-300">{done}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      </form>
    </Modal>
  );
}
