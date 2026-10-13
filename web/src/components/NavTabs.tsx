'use client';

import React from 'react';
import {
  Layers,
  ChefHat,
  Flame,
  Receipt,
  Shield,
  Banknote,
  Settings,
} from 'lucide-react';

export type WebTabKey =
  | 'order'
  | 'kot'
  | 'shisha'
  | 'live'
  | 'booking'
  | 'billing'
  | 'shifts'
  | 'settings';

interface NavTabsProps {
  activeTab: WebTabKey;
  onTabChange: (tab: WebTabKey) => void;
  activeOrdersCount: number;
  activeKotsCount: number;
  activeShishaCount: number;
  activeBookingsCount: number;
}

export const NavTabs: React.FC<NavTabsProps> = ({
  activeTab,
  onTabChange,
  activeOrdersCount,
  activeKotsCount,
  activeShishaCount,
  activeBookingsCount,
}) => {
  return (
    <nav className="max-w-[1720px] mx-auto mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onTabChange('order')}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
          activeTab === 'order'
            ? 'bg-gradient-to-r from-[#9f1119] to-[#7f0c13] text-white shadow-md shadow-[#9f1119]/30 border border-[#b91c1c]/50'
            : 'bg-[#14161f] text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1f2d] border border-neutral-800/80'
        }`}
      >
        <Layers className="w-4 h-4 text-amber-300" />
        <span>Punch Order</span>
        <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-amber-200 font-mono">
          F1
        </span>
      </button>

      <button
        onClick={() => onTabChange('kot')}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
          activeTab === 'kot'
            ? 'bg-gradient-to-r from-[#9f1119] to-[#7f0c13] text-white shadow-md shadow-[#9f1119]/30 border border-[#b91c1c]/50'
            : 'bg-[#14161f] text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1f2d] border border-neutral-800/80'
        }`}
      >
        <ChefHat className="w-4 h-4 text-emerald-400" />
        <span>KOT Queue / KDS</span>
        {activeKotsCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-black text-[10px] font-extrabold">
            {activeKotsCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onTabChange('shisha')}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
          activeTab === 'shisha'
            ? 'bg-gradient-to-r from-[#9f1119] to-[#7f0c13] text-white shadow-md shadow-[#9f1119]/30 border border-[#b91c1c]/50'
            : 'bg-[#14161f] text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1f2d] border border-neutral-800/80'
        }`}
      >
        <Flame className="w-4 h-4 text-amber-400" />
        <span>Shisha Pot Timers</span>
        {activeShishaCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-extrabold animate-pulse">
            {activeShishaCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onTabChange('live')}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
          activeTab === 'live'
            ? 'bg-gradient-to-r from-[#9f1119] to-[#7f0c13] text-white shadow-md shadow-[#9f1119]/30 border border-[#b91c1c]/50'
            : 'bg-[#14161f] text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1f2d] border border-neutral-800/80'
        }`}
      >
        <Receipt className="w-4 h-4 text-sky-400" />
        <span>Live Tables</span>
        {activeOrdersCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-black text-[10px] font-extrabold">
            {activeOrdersCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onTabChange('booking')}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
          activeTab === 'booking'
            ? 'bg-gradient-to-r from-[#9f1119] to-[#7f0c13] text-white shadow-md shadow-[#9f1119]/30 border border-[#b91c1c]/50'
            : 'bg-[#14161f] text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1f2d] border border-neutral-800/80'
        }`}
      >
        <Shield className="w-4 h-4 text-purple-400" />
        <span>Private VIP & Cabins</span>
        {activeBookingsCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-purple-500 text-white text-[10px] font-extrabold">
            {activeBookingsCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onTabChange('billing')}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
          activeTab === 'billing'
            ? 'bg-gradient-to-r from-[#9f1119] to-[#7f0c13] text-white shadow-md shadow-[#9f1119]/30 border border-[#b91c1c]/50'
            : 'bg-[#14161f] text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1f2d] border border-neutral-800/80'
        }`}
      >
        <Receipt className="w-4 h-4 text-emerald-300" />
        <span>Cashier & Settlements</span>
      </button>

      <button
        onClick={() => onTabChange('shifts')}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
          activeTab === 'shifts'
            ? 'bg-gradient-to-r from-[#9f1119] to-[#7f0c13] text-white shadow-md shadow-[#9f1119]/30 border border-[#b91c1c]/50'
            : 'bg-[#14161f] text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1f2d] border border-neutral-800/80'
        }`}
      >
        <Banknote className="w-4 h-4 text-amber-300" />
        <span>Shift Drawer / Z-Report</span>
      </button>

      <button
        onClick={() => onTabChange('settings')}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ml-auto ${
          activeTab === 'settings'
            ? 'bg-gradient-to-r from-[#9f1119] to-[#7f0c13] text-white shadow-md shadow-[#9f1119]/30 border border-[#b91c1c]/50'
            : 'bg-[#14161f] text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1f2d] border border-neutral-800/80'
        }`}
      >
        <Settings className="w-4 h-4 text-neutral-400" />
        <span>Lounge Admin</span>
      </button>
    </nav>
  );
};
