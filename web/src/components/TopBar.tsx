'use client';

import React from 'react';
import { AppSettings, AuthUser } from '@/types/pos';
import {
  Flame,
  Volume2,
  VolumeX,
  Clock,
  Database,
  RefreshCw,
  User,
  ShieldCheck,
  Lock,
} from 'lucide-react';

interface TopBarProps {
  settings: AppSettings;
  onToggleSound: () => void;
  dbStatus: 'connected' | 'connecting' | 'fallback';
  dbMessage: string;
  currentTime: string;
  onRefresh: () => void;
  currentUser?: AuthUser | null;
  onOpenAuth: () => void;
  onLock: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  settings,
  onToggleSound,
  dbStatus,
  dbMessage,
  currentTime,
  onRefresh,
  currentUser,
  onOpenAuth,
  onLock,
}) => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3">
      {/* Logo & Lounge Title */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9f1119] to-[#d4af37]/70 flex items-center justify-center shadow-md shadow-[#9f1119]/25 border border-[#d4af37]/30">
            <Flame className="w-5 h-5 text-amber-200 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-wider text-white">
                {settings.loungeName}
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest bg-[#9f1119]/30 text-amber-300 border border-[#9f1119]/60">
                KOT POS
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-medium tracking-tight">
              {settings.tagline} · Multi-Station Engine
            </p>
          </div>
        </div>

        {/* Mobile DB Badge */}
        <div className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#1a1d29] border border-neutral-800">
          <span
            className={`w-2 h-2 rounded-full ${
              dbStatus === 'connected'
                ? 'bg-emerald-400 animate-pulse'
                : dbStatus === 'connecting'
                ? 'bg-amber-400 animate-ping'
                : 'bg-rose-400'
            }`}
          />
          <span className="text-neutral-300">Atlas</span>
        </div>
      </div>

      {/* Status, Sound, Digital Clock and Sync */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end overflow-x-auto">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            dbStatus === 'connected'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : dbStatus === 'connecting'
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
          }`}
          title={dbMessage}
        >
          <Database className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">MongoDB Atlas:</span>
          <span className="capitalize">{dbStatus}</span>
          <span
            className={`w-2 h-2 rounded-full ${
              dbStatus === 'connected'
                ? 'bg-emerald-400'
                : dbStatus === 'connecting'
                ? 'bg-amber-400'
                : 'bg-neutral-500'
            }`}
          />
        </div>

        <button
          onClick={onToggleSound}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
            settings.soundAlerts
              ? 'bg-[#1b1f2d] border-neutral-700 text-amber-300 hover:bg-[#252b3d]'
              : 'bg-[#14161f] border-neutral-800 text-neutral-500 hover:text-neutral-300'
          }`}
          title={settings.soundAlerts ? 'Sound alert chime enabled' : 'Muted'}
        >
          {settings.soundAlerts ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Chime ON</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">Muted</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5 bg-[#14161f] px-3 py-1.5 rounded-lg border border-neutral-800 text-xs font-mono font-bold text-[#d4af37]">
          <Clock className="w-3.5 h-3.5" />
          <span>{currentTime || '00:00:00'}</span>
        </div>

        {/* Staff User & Terminal Lock */}
        {currentUser ? (
          <div className="flex items-center gap-1.5 bg-[#171a26] border border-neutral-700/80 rounded-lg p-1 pl-2.5">
            <div className="flex items-center gap-1.5 text-xs">
              <User className="w-3.5 h-3.5 text-[#d4af37]" />
              <span className="font-bold text-white truncate max-w-[110px]">{currentUser.name}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#9f1119]/50 text-amber-300 border border-[#9f1119]">
                {currentUser.role}
              </span>
            </div>
            <button
              onClick={onLock}
              className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Lock Terminal / Switch User"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4af37] hover:bg-[#e6c158] text-black font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Staff Sign In</span>
          </button>
        )}

        <button
          onClick={onRefresh}
          className="p-1.5 bg-[#14161f] hover:bg-[#1f2333] border border-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title="Refresh / Sync from DB"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
