"use client";
import React, { useState } from 'react';
import { AuthUser, UserRole } from '@/types/pos';
import {
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  UserCheck,
  Delete,
  X,
  Crown,
  ChefHat,
  Flame,
  Receipt,
  User,
} from 'lucide-react';

interface StaffAuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  requiredRole?: UserRole | 'SUPERVISOR';
  title?: string;
  description?: string;
}

export const StaffAuthModal: React.FC<StaffAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  requiredRole,
  title = 'Staff Terminal Authentication',
  description = 'Enter your 4-digit staff PIN to unlock station controls or switch user session.',
}) => {
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const verifyPin = async (pinToVerify: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToVerify }),
      });
      const json = await res.json();

      if (!json.success || !json.data) {
        setError(json.error || 'Invalid staff PIN. Please try again.');
        setPin('');
        return;
      }

      const user: AuthUser = json.data;

      // Role authorization check if required
      if (requiredRole) {
        if (requiredRole === 'SUPERVISOR') {
          if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
            setError(`Supervisor authority required. Role '${user.role}' is not authorized.`);
            setPin('');
            return;
          }
        } else if (user.role !== requiredRole && user.role !== 'ADMIN') {
          setError(`Role '${requiredRole}' required for this action.`);
          setPin('');
          return;
        }
      }

      onLoginSuccess(user);
      setPin('');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check network connection.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const quickRoles = [
    { name: 'Manager / Admin', pin: '1111', role: 'ADMIN', icon: Crown, color: 'text-amber-400' },
    { name: 'Cashier Desk', pin: '2222', role: 'CASHIER', icon: Receipt, color: 'text-emerald-400' },
    { name: 'Captain 1', pin: '3333', role: 'CAPTAIN', icon: User, color: 'text-sky-400' },
    { name: 'Kitchen Chef', pin: '4444', role: 'KITCHEN_CHEF', icon: ChefHat, color: 'text-rose-400' },
    { name: 'Shisha Master', pin: '5555', role: 'SHISHA_MASTER', icon: Flame, color: 'text-purple-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#12141e] border border-[#d4af37]/40 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#9f1119] to-[#d4af37]/70 flex items-center justify-center shadow-lg border border-[#d4af37]/40">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-extrabold text-white tracking-wide">{title}</h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">{description}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-200 rounded-xl text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* PIN Dots Indicator */}
        <div className="flex justify-center items-center gap-4 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                pin.length > idx
                  ? 'bg-[#d4af37] scale-110 shadow-lg shadow-[#d4af37]/50 ring-2 ring-[#d4af37]/30'
                  : 'bg-neutral-800 border border-neutral-700'
              }`}
            />
          ))}
        </div>

        {/* Numeric PIN Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-xl bg-[#1b1f2e] hover:bg-[#252a3f] active:scale-95 text-xl font-bold text-white border border-neutral-800 transition-all cursor-pointer flex items-center justify-center shadow-sm"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={loading}
            onClick={handleClear}
            className="h-14 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 active:scale-95 text-xs font-bold text-neutral-400 border border-neutral-800 transition-all cursor-pointer flex items-center justify-center uppercase tracking-wider"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDigit('0')}
            className="h-14 rounded-xl bg-[#1b1f2e] hover:bg-[#252a3f] active:scale-95 text-xl font-bold text-white border border-neutral-800 transition-all cursor-pointer flex items-center justify-center shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleBackspace}
            className="h-14 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 active:scale-95 text-neutral-300 border border-neutral-800 transition-all cursor-pointer flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Roles Preset Selector (For Testing / Fast Switch) */}
        <div className="pt-4 border-t border-neutral-800/80">
          <div className="text-[11px] font-bold text-neutral-400 mb-2 uppercase tracking-wider text-center">
            Quick Staff Switch (Tap to Auto-fill PIN)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {quickRoles.map((qr) => {
              const Icon = qr.icon;
              return (
                <button
                  key={qr.pin}
                  type="button"
                  onClick={() => {
                    setPin(qr.pin);
                    verifyPin(qr.pin);
                  }}
                  className="p-2 rounded-lg bg-black/40 hover:bg-[#1f2436] border border-white/5 flex items-center gap-1.5 text-left text-xs transition-colors cursor-pointer group"
                >
                  <Icon className={`w-3.5 h-3.5 ${qr.color} shrink-0`} />
                  <div className="truncate">
                    <div className="font-semibold text-neutral-200 group-hover:text-white truncate">
                      {qr.name}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono">PIN: {qr.pin}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
