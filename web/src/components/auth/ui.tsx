'use client';

import React from 'react';
import { Delete, Flame } from 'lucide-react';

// Minimal Layali primitives for auth & admin screens: dark surfaces, crimson primary, gold accent, 48px targets.

export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9f1119] to-[#d4af37]/70 flex items-center justify-center border border-[#d4af37]/30 mb-3">
            <Flame className="w-6 h-6 text-amber-200" />
          </div>
          <p className="text-xs font-bold tracking-[0.25em] text-[#d4af37]">LAYALI</p>
          <h1 className="text-xl font-bold text-white mt-1">{title}</h1>
          {subtitle && <p className="text-sm text-neutral-400 mt-1">{subtitle}</p>}
        </div>
        <div className="bg-[#12141e] border border-neutral-800 rounded-2xl p-5">{children}</div>
        {footer && <div className="mt-4 text-center text-sm text-neutral-400">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-300">{label}</label>
      <input
        id={id}
        {...props}
        className="w-full h-12 px-3.5 rounded-xl bg-[#0d0f15] border border-neutral-700 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#d4af37]"
      />
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export function SelectField({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-300">{label}</label>
      <select
        id={id}
        {...props}
        className="w-full h-12 px-3 rounded-xl bg-[#0d0f15] border border-neutral-700 text-base text-white focus:outline-none focus:border-[#d4af37]"
      >
        {children}
      </select>
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-[#9f1119] hover:bg-[#b91c1c] text-white',
  secondary: 'bg-[#1b1f2d] hover:bg-[#252b3d] text-neutral-100 border border-neutral-700',
  ghost: 'text-neutral-300 hover:text-white hover:bg-white/5',
  danger: 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 border border-rose-800/60',
};

export function Button({ variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`h-12 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function LinkButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className="text-sm font-medium text-[#d4af37] hover:text-[#e6c158] cursor-pointer py-2" />;
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{children}</p>;
}

export function Modal({ title, onClose, children, width = 'max-w-sm' }: {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  // Take focus so keyboard input can't reach controls behind the dialog
  const dialogRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 outline-none" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full ${width} bg-[#12141e] border border-neutral-800 rounded-2xl p-5 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer text-xl">
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Numeric PIN pad with dots. Submits at `autoSubmitAt` digits, with Enter, or with Continue; clears after each submit. */
export function PinPad({ onSubmit, busy, autoSubmitAt }: {
  onSubmit: (pin: string) => void;
  busy?: boolean;
  autoSubmitAt?: number;
}) {
  const [pin, setPin] = React.useState('');
  // Mirrors `pin` synchronously so fast taps never read a stale value
  const pinRef = React.useRef('');
  const submitRef = React.useRef(onSubmit);
  React.useEffect(() => {
    submitRef.current = onSubmit;
  }, [onSubmit]);

  const update = React.useCallback((next: string) => {
    pinRef.current = next;
    setPin(next);
  }, []);

  const submit = React.useCallback(() => {
    const value = pinRef.current;
    if (value.length < 4) return;
    update('');
    submitRef.current(value);
  }, [update]);

  const press = React.useCallback((digit: string) => {
    if (pinRef.current.length >= 6) return;
    update(pinRef.current + digit);
    if (autoSubmitAt && pinRef.current.length === autoSubmitAt) submit();
  }, [autoSubmitAt, submit, update]);

  const backspace = React.useCallback(() => update(pinRef.current.slice(0, -1)), [update]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy || e.target instanceof HTMLInputElement) return;
      // Keys the pad handles must not also activate a focused button behind it
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Enter') submit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, press, backspace, submit]);

  return (
    <div>
      <div className="flex justify-center gap-3 h-6 mb-5" aria-label={`${pin.length} digits entered`}>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span key={i} className={`w-3.5 h-3.5 rounded-full ${i < pin.length ? 'bg-[#d4af37]' : 'bg-neutral-700'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <PadKey key={d} onClick={() => press(d)} disabled={busy}>{d}</PadKey>
        ))}
        <PadKey onClick={() => update('')} disabled={busy} small>Clear</PadKey>
        <PadKey onClick={() => press('0')} disabled={busy}>0</PadKey>
        <PadKey onClick={backspace} disabled={busy} small aria-label="Delete digit">
          <Delete className="w-5 h-5" />
        </PadKey>
      </div>
      {!autoSubmitAt && (
        <Button className="w-full mt-4" disabled={busy || pin.length < 4} onClick={submit}>
          {busy ? 'Checking…' : 'Continue'}
        </Button>
      )}
    </div>
  );
}

function PadKey({ small, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { small?: boolean }) {
  return (
    <button
      {...props}
      className={`h-16 rounded-xl bg-[#1b1f2d] hover:bg-[#252b3d] active:bg-[#9f1119] border border-neutral-800 text-white flex items-center justify-center cursor-pointer disabled:opacity-50 ${small ? 'text-sm text-neutral-300' : 'text-2xl font-semibold'} ${className}`}
    />
  );
}

/** JSON helper for auth & admin calls: always resolves to { ok, status, data, error }. */
export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }) {
  try {
    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return {
      ok: res.ok && json.success !== false,
      status: res.status,
      data: json.data as T,
      error: (json.error as string) || (res.ok ? '' : 'Something went wrong. Please try again.'),
    };
  } catch {
    return { ok: false, status: 0, data: undefined as T, error: 'Cannot reach the server. Check the network.' };
  }
}
