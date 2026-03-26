import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../lib/utils';
import { ChevronLeft, AlertTriangle } from 'lucide-react';

export default function AdjustBalanceScreen() {
  const { currentBalance, adjustBalance } = useApp();
  const navigate = useNavigate();
  const [newBalance, setNewBalance] = useState('');
  const [note, setNote] = useState('');

  const handleAdjust = async () => {
    if (!newBalance || parseFloat(newBalance) === currentBalance) return;
    await adjustBalance({ newBalance, note });
    navigate('/');
  };

  const diff = newBalance ? parseFloat(newBalance) - currentBalance : 0;

  return (
    <div className="min-h-screen bg-surface px-5 py-5">
      {/* Header */}
      <div className="flex justify-between items-center mb-7">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-brand-500 text-sm">
          <ChevronLeft size={18} /> Back
        </button>
        <p className="text-base font-semibold">Adjust balance</p>
        <div className="w-14" />
      </div>

      {/* Info banner */}
      <div className="bg-warning-50 rounded-[10px] px-3.5 py-3 flex gap-2.5 mb-6">
        <AlertTriangle size={18} className="text-warning-500 shrink-0 mt-0.5" />
        <p className="text-[13px] text-warning-700 leading-relaxed">
          Forgot to log something? No problem. Update your balance and we'll add an adjustment
          entry so your ledger stays honest.
        </p>
      </div>

      {/* Current balance */}
      <div className="text-center mb-6">
        <p className="text-xs text-text-secondary">Current balance</p>
        <p className="text-[28px] font-semibold mt-1">{formatCurrency(currentBalance)}</p>
      </div>

      {/* New balance input */}
      <div className="mb-4">
        <label className="text-xs text-text-secondary block mb-1.5">New actual balance</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="Enter amount"
          value={newBalance}
          onChange={(e) => setNewBalance(e.target.value)}
          autoFocus
          className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-lg text-center focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Diff preview */}
      {newBalance && Math.abs(diff) >= 0.01 && (
        <div className="text-center mb-4">
          <span
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{
              backgroundColor: diff > 0 ? '#E1F5EE' : '#FCEBEB',
              color: diff > 0 ? '#085041' : '#791F1F',
            }}
          >
            {diff > 0 ? '+' : ''}{formatCurrency(diff)} adjustment
          </span>
        </div>
      )}

      {/* Note */}
      <div className="mb-6">
        <label className="text-xs text-text-secondary block mb-1.5">Note (optional)</label>
        <input
          type="text"
          placeholder="e.g. Forgot to log lunch yesterday"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Save */}
      <button
        onClick={handleAdjust}
        disabled={!newBalance || Math.abs(diff) < 0.01}
        className="w-full py-3.5 rounded-[10px] bg-brand-500 text-white text-[15px] font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
      >
        Apply adjustment
      </button>
    </div>
  );
}
