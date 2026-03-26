import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDateRelative } from '../lib/utils';
import { ChevronLeft } from 'lucide-react';

export default function ReconcileScreen() {
  const { activeAccount, currentBalance, reconcile, adjustBalance } = useApp();
  const navigate = useNavigate();
  const [newBalance, setNewBalance] = useState('');

  if (!activeAccount) return null;

  const lastReconciled = activeAccount.lastReconciledAt
    ? formatDateRelative(new Date(activeAccount.lastReconciledAt))
    : 'Never';

  const handleConfirmMatch = async () => {
    await reconcile({ balance: currentBalance, matched: true });
    navigate('/');
  };

  const handleUpdateBalance = async () => {
    if (!newBalance || parseFloat(newBalance) === currentBalance) return;
    await reconcile({ balance: parseFloat(newBalance), matched: false });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface px-5 py-5">
      {/* Header */}
      <div className="flex justify-between items-center mb-7">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-brand-500 text-sm">
          <ChevronLeft size={18} /> Back
        </button>
        <p className="text-base font-semibold">Check your balance</p>
        <div className="w-14" />
      </div>

      {/* Current balance display */}
      <div className="text-center py-6 border-b border-border mb-6">
        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">
          TilPaid shows your balance as
        </p>
        <p className="text-4xl font-semibold mt-2">{formatCurrency(currentBalance)}</p>
        <p className="text-[13px] text-text-muted mt-2">
          {activeAccount.name} · Last checked {lastReconciled}
        </p>
      </div>

      {/* Instructions */}
      <p className="text-sm font-medium mb-1.5">Does this match your bank?</p>
      <p className="text-[13px] text-text-secondary mb-5 leading-relaxed">
        Open your bank app and compare the balance. If it's different, enter the real number below and we'll fix it.
      </p>

      {/* Confirm match */}
      <button
        onClick={handleConfirmMatch}
        className="w-full py-3.5 rounded-[10px] bg-success-50 text-success-700 border border-success-500/30 text-[15px] font-medium mb-3 active:scale-[0.98] transition-transform"
      >
        Yes, it matches ✓
      </button>

      {/* Or update */}
      <div className="mb-3">
        <label className="text-xs text-text-secondary block mb-1.5">Or enter your actual balance</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder={formatCurrency(currentBalance)}
          value={newBalance}
          onChange={(e) => setNewBalance(e.target.value)}
          className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <button
        onClick={handleUpdateBalance}
        disabled={!newBalance || parseFloat(newBalance) === currentBalance}
        className="w-full py-3.5 rounded-[10px] bg-surface-card border border-border text-[15px] font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
      >
        Update balance
      </button>

      <p className="text-xs text-text-muted text-center mt-3">
        This will create an adjustment entry in your ledger
      </p>
    </div>
  );
}
