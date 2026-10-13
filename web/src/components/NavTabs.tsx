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
  Users,
} from 'lucide-react';
import type { Permission } from '@/lib/auth/permissions';

export type WebTabKey =
  | 'order'
  | 'kot'
  | 'shisha'
  | 'live'
  | 'booking'
  | 'billing'
  | 'shifts'
  | 'settings'
  | 'team';

interface TabDef {
  key: WebTabKey;
  label: string;
  icon: React.ElementType;
  iconClass: string;
  permission: Permission;
  badgeClass?: string;
}

const TABS: TabDef[] = [
  { key: 'order', label: 'Punch Order', icon: Layers, iconClass: 'text-amber-300', permission: 'order.create' },
  { key: 'kot', label: 'KOT Queue / KDS', icon: ChefHat, iconClass: 'text-emerald-400', permission: 'kot.update', badgeClass: 'bg-emerald-500 text-black' },
  { key: 'shisha', label: 'Shisha Pot Timers', icon: Flame, iconClass: 'text-amber-400', permission: 'shisha.manage', badgeClass: 'bg-amber-500 text-black' },
  { key: 'live', label: 'Live Tables', icon: Receipt, iconClass: 'text-sky-400', permission: 'order.create', badgeClass: 'bg-sky-500 text-black' },
  { key: 'booking', label: 'Private VIP & Cabins', icon: Shield, iconClass: 'text-purple-400', permission: 'booking.manage', badgeClass: 'bg-purple-500 text-white' },
  { key: 'billing', label: 'Cashier & Settlements', icon: Receipt, iconClass: 'text-emerald-300', permission: 'bill.settle' },
  { key: 'shifts', label: 'Shift Drawer / Z-Report', icon: Banknote, iconClass: 'text-amber-300', permission: 'shift.manage' },
  { key: 'settings', label: 'Lounge Admin', icon: Settings, iconClass: 'text-neutral-400', permission: 'menu.stock' },
  { key: 'team', label: 'Staff & Devices', icon: Users, iconClass: 'text-[#d4af37]', permission: 'staff.manage' },
];

/** Tabs the given permissions allow, in display order. */
export function allowedTabs(permissions: Permission[]): WebTabKey[] {
  return TABS.filter((t) => permissions.includes(t.permission)).map((t) => t.key);
}

interface NavTabsProps {
  activeTab: WebTabKey;
  onTabChange: (tab: WebTabKey) => void;
  visibleTabs: WebTabKey[];
  badges: Partial<Record<WebTabKey, number>>;
}

export const NavTabs: React.FC<NavTabsProps> = ({ activeTab, onTabChange, visibleTabs, badges }) => {
  return (
    <nav className="max-w-[1720px] mx-auto mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {TABS.filter((t) => visibleTabs.includes(t.key)).map((tab) => {
        const Icon = tab.icon;
        const badge = badges[tab.key] ?? 0;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              tab.key === 'settings' ? 'ml-auto' : ''
            } ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-[#9f1119] to-[#7f0c13] text-white shadow-md shadow-[#9f1119]/30 border border-[#b91c1c]/50'
                : 'bg-[#14161f] text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1f2d] border border-neutral-800/80'
            }`}
          >
            <Icon className={`w-4 h-4 ${tab.iconClass}`} />
            <span>{tab.label}</span>
            {badge > 0 && tab.badgeClass && (
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-extrabold ${tab.badgeClass}`}>{badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
