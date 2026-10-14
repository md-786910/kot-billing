'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { requestPrint } from '@/lib/print/printer';
import { ShiftRegister } from '@/types/pos';
import { formatINR, formatDateTime } from '@/utils/format';
import {
  Banknote,
  DollarSign,
  TrendingUp,
  CreditCard,
  QrCode,
  ShieldAlert,
  Printer,
  PlusCircle,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  FileText,
  Clock,
  ArrowDownRight,
} from 'lucide-react';

export const ShiftRegisterView: React.FC = () => {
  const [currentShift, setCurrentShift] = useState<ShiftRegister | null>(null);
  const [pastShifts, setPastShifts] = useState<ShiftRegister[]>([]);
  const [loading, setLoading] = useState(false);

  // Open shift form
  const [openFloat, setOpenFloat] = useState<string>('2000');
  const [openNotes, setOpenNotes] = useState<string>('Morning opening register');

  // Cash drop form
  const [showDropModal, setShowDropModal] = useState(false);
  const [dropAmount, setDropAmount] = useState<string>('');
  const [dropReason, setDropReason] = useState<string>('');

  // Close shift modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCash, setActualCash] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState<string>('');

  // Printable Z-Report state
  const [zReportData, setZReportData] = useState<ShiftRegister | null>(null);

  const fetchShiftData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/shifts');
      const json = await res.json();
      if (json.success) {
        setCurrentShift(json.currentShift || null);
        setPastShifts(json.pastShifts || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShiftData();
  }, [fetchShiftData]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          openingFloat: Number(openFloat || 0),
          notes: openNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchShiftData();
      } else {
        alert(json.error || 'Failed to open shift');
      }
    } catch (err: any) {
      alert('Network error: ' + err.message);
    }
  };

  const handleCashDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropAmount || Number(dropAmount) <= 0 || !dropReason.trim()) {
      alert('Please enter valid amount and reason for cash payout.');
      return;
    }
    try {
      const res = await fetch('/api/v1/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'drop',
          amount: Number(dropAmount),
          reason: dropReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowDropModal(false);
        setDropAmount('');
        setDropReason('');
        fetchShiftData();
      } else {
        alert(json.error || 'Failed to record cash drop');
      }
    } catch (err: any) {
      alert('Network error: ' + err.message);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCash === '') {
      alert('Please enter actual cash counted in drawer till.');
      return;
    }
    try {
      const res = await fetch('/api/v1/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          closingCashActual: Number(actualCash),
          notes: closeNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCloseModal(false);
        setZReportData(json.data);
        // The server queues the Z-report for the counter printer
        setActualCash('');
        fetchShiftData();
      } else {
        alert(json.error || 'Failed to close shift');
      }
    } catch (err: any) {
      alert('Network error: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-[#14161f] border border-neutral-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#d4af37]" />
            <span>Shift Register & Day-End Cashier Reconciliation</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage cash drawer opening floats, payouts, live sales reconciliation, and Z-Reports.
          </p>
        </div>

        {currentShift ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDropModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1b1f2d] hover:bg-[#252b3d] border border-neutral-700 text-amber-300 rounded-lg text-xs font-bold cursor-pointer transition-colors"
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Record Cash Payout</span>
            </button>
            <button
              onClick={() => setShowCloseModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#9f1119] hover:bg-[#b91c1c] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-md"
            >
              <Lock className="w-4 h-4" />
              <span>Close Shift & Z-Report</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Main Shift Status View */}
      {!currentShift ? (
        /* NO SHIFT OPEN: Show Opening Form */
        <div className="bg-[#12141d] border border-neutral-800 rounded-2xl p-8 max-w-xl mx-auto shadow-xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#1b1f2d] border border-neutral-700 flex items-center justify-center mx-auto mb-3">
              <Unlock className="w-7 h-7 text-[#d4af37]" />
            </div>
            <h3 className="text-lg font-bold text-white">Open Cashier Shift Register</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Start your shift by entering the opening float cash present in the till drawer.
            </p>
          </div>

          <form onSubmit={handleOpenShift} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                Opening Cash Float (₹):
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={openFloat}
                onChange={(e) => setOpenFloat(e.target.value)}
                placeholder="2000"
                className="w-full bg-[#0a0c10] border border-neutral-700 rounded-xl px-4 py-2.5 text-base font-bold text-[#d4af37] focus:outline-none focus:border-[#d4af37]"
              />
              <span className="text-[11px] text-neutral-500 mt-1 block">
                Cash bills and coins inside the till at beginning of day.
              </span>
            </div>

            

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5">Shift Notes / Float Breakdown:</label>
              <input
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="e.g. 5x 200, 10x 100"
                className="w-full bg-[#0a0c10] border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-300 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-[#9f1119] to-[#7f0c13] hover:from-[#b91c1c] hover:to-[#9f1119] text-white font-bold text-sm rounded-xl cursor-pointer transition-all shadow-lg shadow-[#9f1119]/25 mt-2"
            >
              START REGISTER SHIFT
            </button>
          </form>
        </div>
      ) : (
        /* ACTIVE SHIFT: Live Register Balances */
        <div className="space-y-6">
          {/* Active Shift Info Banner */}
          <div className="bg-[#12141d] border border-emerald-900/50 bg-gradient-to-r from-emerald-950/20 to-transparent rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <div className="text-sm font-extrabold text-white flex items-center gap-2">
                  <span>ACTIVE SHIFT: {currentShift.shiftNumber}</span>
                  <span className="text-xs font-normal text-neutral-400">
                    · Opened by <strong className="text-white">{currentShift.openedBy}</strong>
                  </span>
                </div>
                <div className="text-xs text-neutral-400">
                  Started: {formatDateTime(currentShift.openedAt)}
                </div>
              </div>
            </div>

            <div className="text-xs text-neutral-300 bg-[#161a26] border border-neutral-800 px-3 py-1.5 rounded-lg">
              Settled Orders: <strong className="text-emerald-300 font-mono">{currentShift.ordersCount}</strong>
            </div>
          </div>

          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#12141d] border border-neutral-800 rounded-xl p-4">
              <span className="text-[11px] font-bold text-neutral-400 uppercase">Opening Float</span>
              <div className="text-xl font-extrabold text-[#d4af37] font-mono mt-1">
                {formatINR(currentShift.openingFloat)}
              </div>
              <span className="text-[10px] text-neutral-500">Till Base Amount</span>
            </div>

            <div className="bg-[#12141d] border border-neutral-800 rounded-xl p-4">
              <span className="text-[11px] font-bold text-emerald-400 uppercase">Cash Collected</span>
              <div className="text-xl font-extrabold text-emerald-400 font-mono mt-1">
                {formatINR(currentShift.totalCash)}
              </div>
              <span className="text-[10px] text-neutral-500">From Cash Sales</span>
            </div>

            <div className="bg-[#12141d] border border-neutral-800 rounded-xl p-4">
              <span className="text-[11px] font-bold text-sky-400 uppercase">Digital / UPI Sales</span>
              <div className="text-xl font-extrabold text-sky-400 font-mono mt-1">
                {formatINR((currentShift.totalUpi || 0) + (currentShift.totalCard || 0))}
              </div>
              <span className="text-[10px] text-neutral-500">
                UPI: {formatINR(currentShift.totalUpi)} · Card: {formatINR(currentShift.totalCard)}
              </span>
            </div>

            <div className="bg-[#12141d] border border-amber-900/60 bg-amber-950/20 rounded-xl p-4">
              <span className="text-[11px] font-bold text-amber-300 uppercase">Expected Till Cash</span>
              <div className="text-xl font-extrabold text-amber-300 font-mono mt-1">
                {formatINR(currentShift.expectedCash)}
              </div>
              <span className="text-[10px] text-amber-200/60">Float + Cash - Payouts</span>
            </div>
          </div>

          {/* Cash Drops & Payouts Ledger */}
          <div className="bg-[#12141d] border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-rose-400" />
                <span>Shift Cash Payouts / Drops</span>
              </h3>
              <button
                onClick={() => setShowDropModal(true)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                + Add Payout
              </button>
            </div>

            {(!currentShift.cashDrops || currentShift.cashDrops.length === 0) ? (
              <p className="text-xs text-neutral-500 italic py-2">
                No cash drops recorded during this shift.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-400">
                      <th className="py-2">Time</th>
                      <th className="py-2">Reason / Vendor</th>
                      <th className="py-2">Authorized Staff</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentShift.cashDrops.map((d, idx) => (
                      <tr key={idx} className="border-b border-neutral-800/50">
                        <td className="py-2 text-neutral-400 font-mono">{formatDateTime(d.timestamp)}</td>
                        <td className="py-2 text-white font-medium">{d.reason}</td>
                        <td className="py-2 text-neutral-300">{d.staff}</td>
                        <td className="py-2 text-right font-mono font-bold text-rose-400">
                          - {formatINR(d.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Past Shifts Z-Reports History */}
      {pastShifts.length > 0 && (
        <div className="bg-[#12141d] border border-neutral-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-400" />
            <span>Closed Shifts & Z-Report History</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400">
                  <th className="py-2">Shift #</th>
                  <th className="py-2">Opened</th>
                  <th className="py-2">Closed</th>
                  <th className="py-2">Total Turnover</th>
                  <th className="py-2">Expected Cash</th>
                  <th className="py-2">Actual Cash</th>
                  <th className="py-2 text-right">Discrepancy</th>
                </tr>
              </thead>
              <tbody>
                {pastShifts.map((ps) => {
                  const diff = ps.cashDifference || 0;
                  return (
                    <tr key={ps.shiftNumber} className="border-b border-neutral-800/50 hover:bg-[#181b26]">
                      <td className="py-2.5 font-bold font-mono text-[#d4af37]">{ps.shiftNumber}</td>
                      <td className="py-2.5 text-neutral-400">{formatDateTime(ps.openedAt)}</td>
                      <td className="py-2.5 text-neutral-400">{ps.closedAt ? formatDateTime(ps.closedAt) : '-'}</td>
                      <td className="py-2.5 font-mono font-bold text-white">{formatINR(ps.totalSales)}</td>
                      <td className="py-2.5 font-mono text-neutral-300">{formatINR(ps.expectedCash)}</td>
                      <td className="py-2.5 font-mono text-neutral-300">{formatINR(ps.closingCashActual)}</td>
                      <td className="py-2.5 text-right font-mono font-bold">
                        {diff === 0 ? (
                          <span className="text-emerald-400">Exact ₹0</span>
                        ) : diff > 0 ? (
                          <span className="text-emerald-400">Over +{formatINR(diff)}</span>
                        ) : (
                          <span className="text-rose-400">Short {formatINR(diff)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Cash Drop Modal */}
      {showDropModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141d] border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Record Cash Payout / Drop</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Deducts cash from current till drawer (e.g. lemons, ice, emergency supply).
            </p>

            <form onSubmit={handleCashDrop} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Amount (₹):</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={dropAmount}
                  onChange={(e) => setDropAmount(e.target.value)}
                  placeholder="500"
                  className="w-full bg-[#0a0c10] border border-neutral-700 rounded-xl px-3.5 py-2 text-white font-mono text-base focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Payout Reason:</label>
                <input
                  type="text"
                  required
                  value={dropReason}
                  onChange={(e) => setDropReason(e.target.value)}
                  placeholder="e.g. Fresh mint & ice purchase"
                  className="w-full bg-[#0a0c10] border border-neutral-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDropModal(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#9f1119] hover:bg-[#b91c1c] text-white text-xs font-bold rounded-xl cursor-pointer shadow-md"
                >
                  Record Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseModal && currentShift && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141d] border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Close Register Shift & Reconcile</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Count the physical cash in the till and enter the total below.
            </p>

            <div className="bg-[#1b1f2d] border border-neutral-800 p-3 rounded-xl mb-4 text-xs space-y-1">
              <div className="flex justify-between text-neutral-300">
                <span>Opening Float:</span>
                <span className="font-mono">{formatINR(currentShift.openingFloat)}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Cash Collected:</span>
                <span className="font-mono text-emerald-400">+{formatINR(currentShift.totalCash)}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Cash Payouts:</span>
                <span className="font-mono text-rose-400">
                  -{formatINR((currentShift.cashDrops || []).reduce((s, d) => s + d.amount, 0))}
                </span>
              </div>
              <div className="flex justify-between font-bold text-amber-300 pt-1 border-t border-neutral-700">
                <span>System Expected Cash:</span>
                <span className="font-mono text-sm">{formatINR(currentShift.expectedCash)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Actual Cash Counted in Till (₹):
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="Enter counted cash"
                  className="w-full bg-[#0a0c10] border border-neutral-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-base font-bold focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              {actualCash !== '' && (
                <div className="p-2.5 rounded-lg text-xs font-mono font-bold bg-[#0a0c10] border border-neutral-800 flex justify-between">
                  <span>Reconciliation Discrepancy:</span>
                  <span
                    className={
                      Number(actualCash) - (currentShift.expectedCash || 0) === 0
                        ? 'text-emerald-400'
                        : Number(actualCash) - (currentShift.expectedCash || 0) > 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }
                  >
                    {Number(actualCash) - (currentShift.expectedCash || 0) === 0
                      ? 'EXACT MATCH (₹0)'
                      : Number(actualCash) - (currentShift.expectedCash || 0) > 0
                      ? `OVER +${formatINR(Number(actualCash) - (currentShift.expectedCash || 0))}`
                      : `SHORT ${formatINR(Number(actualCash) - (currentShift.expectedCash || 0))}`}
                  </span>
                </div>
              )}

              

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Closing Notes:</label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Optional comments on discrepancies"
                  className="w-full bg-[#0a0c10] border border-neutral-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#9f1119] hover:bg-[#b91c1c] text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg"
                >
                  CLOSE SHIFT & PRINT Z-REPORT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Z-Report Modal */}
      {zReportData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black font-mono text-xs max-w-sm w-full p-6 rounded-lg shadow-2xl space-y-3">
            <div className="text-center border-b-2 border-black border-dashed pb-2">
              <h4 className="font-extrabold text-sm tracking-wider">LAYALI SHISHA LOUNGE</h4>
              <div className="text-[10px] uppercase font-bold">DAILY Z-REPORT · SHIFT SUMMARY</div>
              <div className="text-[10px]">Shift #: {zReportData.shiftNumber}</div>
              <div className="text-[10px]">{formatDateTime(zReportData.closedAt || new Date().toISOString())}</div>
            </div>

            <div className="border-b border-black border-dashed pb-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Opened by:</span>
                <span className="font-bold">{zReportData.openedBy}</span>
              </div>
              <div className="flex justify-between">
                <span>Closed by:</span>
                <span className="font-bold">{zReportData.closedBy}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Settled Orders:</span>
                <span className="font-bold">{zReportData.ordersCount}</span>
              </div>
            </div>

            <div className="border-b-2 border-black border-dashed pb-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Gross F&B Sales:</span>
                <span className="font-bold">{formatINR(zReportData.totalSales)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Total Discounts:</span>
                <span>-{formatINR(zReportData.totalDiscount)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Total GST:</span>
                <span>+{formatINR(zReportData.totalTax)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-black pt-1">
                <span>Cash Sales:</span>
                <span>{formatINR(zReportData.totalCash)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>UPI Collections:</span>
                <span>{formatINR(zReportData.totalUpi)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Card Collections:</span>
                <span>{formatINR(zReportData.totalCard)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Customer Credit:</span>
                <span>{formatINR(zReportData.totalCredit)}</span>
              </div>
            </div>

            <div className="border-b-2 border-black border-dashed pb-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Opening Cash Float:</span>
                <span>{formatINR(zReportData.openingFloat)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Drops / Payouts:</span>
                <span>-{formatINR((zReportData.cashDrops || []).reduce((s, d) => s + d.amount, 0))}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Expected Drawer Cash:</span>
                <span>{formatINR(zReportData.expectedCash)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Actual Counted Cash:</span>
                <span>{formatINR(zReportData.closingCashActual)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs border-t border-black pt-1">
                <span>DISCREPANCY:</span>
                <span>
                  {(zReportData.cashDifference || 0) === 0
                    ? 'EXACT (₹0)'
                    : (zReportData.cashDifference || 0) > 0
                    ? `OVER +${formatINR(zReportData.cashDifference)}`
                    : `SHORT ${formatINR(zReportData.cashDifference)}`}
                </span>
              </div>
            </div>

            <div className="text-center text-[10px] pt-1">
              *** END OF SHIFT REPORT ***
            </div>

            <div className="flex gap-2 pt-2 no-print">
              <button
                onClick={() => zReportData && requestPrint({ kind: 'zreport', shiftId: zReportData.shiftNumber })}
                className="flex-1 py-2 bg-black text-white text-xs font-bold rounded cursor-pointer"
              >
                Print Z-Report
              </button>
              <button
                onClick={() => setZReportData(null)}
                className="px-4 py-2 border border-black text-xs font-bold rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
