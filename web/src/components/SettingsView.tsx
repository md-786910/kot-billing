"use client";
import React, { useState } from 'react';
import { MenuItem, AppSettings, Station } from '../types/pos';
import { formatINR } from '../utils/format';
import {
  Settings,
  Download,
  Plus,
  Edit2,
  Trash2,
  Save,
  Volume2,
  VolumeX,
  ShieldAlert,
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  menu: MenuItem[];
  /** Saves to the server; resolves to an error message, or null when saved */
  onUpdateSettings: (newSettings: AppSettings) => Promise<string | null>;
  /** Called after a menu change is saved, to reload the menu */
  onMenuChanged: () => void;
  onExportData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  menu,
  onUpdateSettings,
  onMenuChanged,
  onExportData,
}) => {
  // Settings form
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(99);

  // New item modal
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number>(99);
  const [newItemStation, setNewItemStation] = useState<Station>('Kitchen');
  const [newItemCategory, setNewItemCategory] = useState('Snacks');

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = await onUpdateSettings(formData);
    alert(error ?? 'Settings saved. New bills will use these details.');
  };

  // Menu changes are saved on the server, then the menu reloads
  const saveMenu = async (method: 'POST' | 'PATCH', body: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/v1/menu', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Could not save the menu change');
        return false;
      }
      onMenuChanged();
      return true;
    } catch {
      alert('Cannot reach the server. The menu was not changed.');
      return false;
    }
  };

  const handlePriceUpdate = async (id: string) => {
    if (await saveMenu('PATCH', { id, price: Number(editPrice) })) setEditingItemId(null);
  };

  const handleToggleAvailable = (id: string) => {
    const item = menu.find((m) => m.id === id);
    if (item) saveMenu('PATCH', { id, isAvailable: !item.isAvailable });
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const saved = await saveMenu('POST', {
      name: newItemName.trim(),
      price: Number(newItemPrice),
      station: newItemStation,
      category: newItemCategory.trim(),
    });
    if (saved) {
      setNewItemName('');
      setNewItemPrice(99);
    }
  };

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <div className="bg-[#14161f] border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-[#d4af37]" />
          <div>
            <h2 className="text-base font-bold text-white">Lounge & Billing Configuration</h2>
            <p className="text-xs text-neutral-400">
              Tax percentage, thermal invoice header, and Shisha session duration defaults.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">
                Lounge / Business Name
              </label>
              <input
                type="text"
                value={formData.loungeName}
                onChange={(e) => setFormData({ ...formData, loungeName: e.target.value })}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-300 mb-1">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-300 mb-1">
                GSTIN / Tax Number
              </label>
              <input
                type="text"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-300 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-300 mb-1">
                GST Tax Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="28"
                value={formData.taxPercent}
                onChange={(e) => setFormData({ ...formData, taxPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-[#d4af37] font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-300 mb-1">
                Default Shisha Pot Duration (Minutes)
              </label>
              <input
                type="number"
                min="15"
                max="180"
                value={formData.shishaDefaultDuration}
                onChange={(e) =>
                  setFormData({ ...formData, shishaDefaultDuration: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-[#1b1e2a] border border-neutral-700 rounded-lg text-white font-mono"
              />
            </div>
          </div>

          <fieldset className="pt-2">
            <legend className="text-sm font-semibold text-neutral-300 mb-2">KOT copies (each prints on its own cut)</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-200">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked disabled className="w-4 h-4" />
                Station copy (kitchen / bar / shisha) — always
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.kotStaffCopy ?? true}
                  onChange={(e) => setFormData({ ...formData, kotStaffCopy: e.target.checked })}
                  className="w-4 h-4"
                  data-testid="kot-copy-staff"
                />
                Staff copy
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.kotAdminCopy ?? true}
                  onChange={(e) => setFormData({ ...formData, kotAdminCopy: e.target.checked })}
                  className="w-4 h-4"
                  data-testid="kot-copy-admin"
                />
                Admin copy
              </label>
            </div>
          </fieldset>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.soundAlerts}
                onChange={(e) => setFormData({ ...formData, soundAlerts: e.target.checked })}
                className="rounded border-neutral-700 text-[#9f1119] focus:ring-0"
              />
              <span>Enable Web Audio bell chime on new orders and timer alerts</span>
            </label>

            <button
              type="submit"
              className="px-4 py-2 bg-[#9f1119] hover:bg-[#b91c1c] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      </div>

      {/* Menu Manager */}
      <div className="bg-[#14161f] border border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">Menu Pricing & Catalog</h3>
            <p className="text-xs text-neutral-400">
              Manage Layali prices (₹99 snacks/burgers/maggie/drinks, ₹249/₹299 shishas) or add new items.
            </p>
          </div>
        </div>

        {/* Add custom item form */}
        <form onSubmit={handleAddItem} className="p-3 bg-[#181a25] border border-neutral-800 rounded-lg grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <input
              type="text"
              placeholder="Item name (e.g. Masala Chai)"
              required
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#12131b] border border-neutral-700 rounded text-white"
            />
          </div>
          <div>
            <input
              type="number"
              placeholder="Price (₹)"
              required
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-[#12131b] border border-neutral-700 rounded text-[#d4af37] font-mono font-bold"
            />
          </div>
          <div>
            <select
              value={newItemStation}
              onChange={(e) => setNewItemStation(e.target.value as Station)}
              className="w-full px-2.5 py-1.5 bg-[#12131b] border border-neutral-700 rounded text-white"
            >
              <option value="Kitchen">Kitchen</option>
              <option value="Beverage Counter">Beverage Counter</option>
              <option value="Shisha Master">Shisha Master</option>
            </select>
          </div>
          <div>
            <input
              type="text"
              placeholder="Category (e.g. Beverages)"
              required
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#12131b] border border-neutral-700 rounded text-white"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#1e2333] hover:bg-[#282f46] text-white font-semibold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Add Item</span>
          </button>
        </form>

        {/* Menu list with price quick-edit */}
        <div className="max-h-[380px] overflow-y-auto border border-neutral-800 rounded-lg divide-y divide-neutral-800 text-xs">
          {menu.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-[#151722] flex items-center justify-between gap-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-white">{item.name}</span>
                <span className="text-[10px] text-neutral-400 ml-2">
                  {item.category} · {item.station}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {editingItemId === item.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(Number(e.target.value))}
                      className="w-20 px-2 py-1 bg-black border border-neutral-600 rounded text-right text-xs text-[#d4af37] font-mono font-bold"
                    />
                    <button
                      onClick={() => handlePriceUpdate(item.id)}
                      className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-bold cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingItemId(null)}
                      className="px-2 py-1 bg-neutral-700 text-neutral-300 rounded text-[11px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#d4af37]">
                      {formatINR(item.price)}
                    </span>
                    <button
                      onClick={() => {
                        setEditingItemId(item.id);
                        setEditPrice(item.price);
                      }}
                      className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 cursor-pointer"
                      title="Edit Price"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleToggleAvailable(item.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer ${
                    item.isAvailable
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  {item.isAvailable ? 'In Stock' : '86ed'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Backup, Export & Clear */}
      <div className="bg-[#14161f] border border-neutral-800 rounded-xl p-5 space-y-4">
        <h3 className="text-base font-bold text-white">Export</h3>
        <p className="text-sm text-neutral-400">
          Download orders, bookings and KOTs as a JSON file for your records.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onExportData}
            className="px-4 py-2 bg-[#1b1e2a] hover:bg-[#252a3b] text-white rounded-lg text-xs font-semibold border border-neutral-700 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4 text-[#d4af37]" />
            <span>Export Backup JSON</span>
          </button>


        </div>
      </div>
    </div>
  );
};
