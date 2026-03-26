import { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, generateUpcomingOccurrences, todayISO, daysUntil, createTransaction } from '../lib/utils';
import * as db from '../lib/db';
import TransactionCard from '../components/TransactionCard';
import StartingBalanceLine from '../components/StartingBalanceLine';
import AccountSwitcher from '../components/AccountSwitcher';
import BottomNav from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Search, X, CalendarClock, Zap } from 'lucide-react';
import OnboardingOverlay from '../components/OnboardingOverlay';

export default function HomeScreen() {
  const {
    activeAccount,
    activeAccountId,
    currentBalance,
    transactionsWithBalances,
    refreshTransactions,
    isPremium,
    nextPayDate,
  } = useApp();
  const navigate = useNavigate();
  const [recurringScheduled, setRecurringScheduled] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [warningThreshold, setWarningThreshold] = useState(250);
  const [actionItem, setActionItem] = useState(null); // for recurring action sheet

  useEffect(() => {
    refreshTransactions();
    db.getSetting('warningThreshold').then(val => {
      if (val !== undefined) setWarningThreshold(val);
    });
  }, [refreshTransactions]);

  const today = todayISO();
  const payDate = nextPayDate || null;

  // Split ledger
  const manualScheduled = useMemo(() => {
    return transactionsWithBalances.filter(tx => tx.date > today && !tx.isAdjustment);
  }, [transactionsWithBalances, today]);

  const recentTransactions = useMemo(() => {
    return transactionsWithBalances.filter(tx => tx.date <= today || tx.isAdjustment);
  }, [transactionsWithBalances, today]);

  // Actual bank balance
  const scheduledLedgerTotal = useMemo(() => {
    return manualScheduled.reduce((sum, tx) => sum + tx.amount, 0);
  }, [manualScheduled]);

  const actualBalance = useMemo(() => {
    return Math.round((currentBalance - scheduledLedgerTotal) * 100) / 100;
  }, [currentBalance, scheduledLedgerTotal]);

  // Dynamic payday from scheduled paycheck
  const effectivePayDate = useMemo(() => {
    const manualPaycheck = manualScheduled.find(tx => tx.categoryId === 'cat-paycheck');
    if (manualPaycheck) return manualPaycheck.date;
    const recurringPaycheck = recurringScheduled.find(item => item.categoryId === 'cat-paycheck');
    if (recurringPaycheck) return recurringPaycheck.date;
    return payDate;
  }, [manualScheduled, recurringScheduled, payDate]);

  const daysTilPay = effectivePayDate ? daysUntil(effectivePayDate) : null;

  // Load recurring → auto-populate
  useEffect(() => {
    async function loadRecurringForScheduled() {
      if (!activeAccountId) { setRecurringScheduled([]); return; }
      const recurring = await db.getRecurringTransactions(activeAccountId);
      if (recurring.length === 0) { setRecurringScheduled([]); return; }

      const lookAhead = payDate ? Math.max(daysUntil(payDate) + 7, 42) : 42;
      const allUpcoming = recurring
        .filter(r => r.isActive)
        .flatMap(r => generateUpcomingOccurrences(r, lookAhead));
      allUpcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

      // De-duplicate: skip recurring items that already have a matching manual entry
      // Check both scheduled AND recent transactions (for "post early" cases)
      const allManualDescs = new Set(
        transactionsWithBalances
          .filter(tx => !tx.isAdjustment)
          .map(tx => tx.description?.toLowerCase())
          .filter(Boolean)
      );

      const autoScheduled = allUpcoming
        .filter(item => {
          if (item.date <= today) return false;
          // Check if any manual transaction has the same description and is within 7 days of this date
          const hasMatch = transactionsWithBalances.some(tx => {
            if (tx.isAdjustment) return false;
            if (tx.description?.toLowerCase() !== item.description?.toLowerCase()) return false;
            const txDate = new Date(tx.date);
            const itemDate = new Date(item.date);
            const daysDiff = Math.abs((txDate - itemDate) / (1000 * 60 * 60 * 24));
            return daysDiff <= 7;
          });
          return !hasMatch;
        })
        .map(item => ({ ...item, isRecurringAuto: true }));

      setRecurringScheduled(autoScheduled);
    }
    loadRecurringForScheduled();
  }, [activeAccountId, currentBalance, transactionsWithBalances, today, payDate]);

  // Post early handler
  const handlePostEarly = async (item) => {
    const tx = createTransaction({
      accountId: item.accountId,
      amount: Math.abs(item.amount),
      description: item.description,
      categoryId: item.categoryId,
      date: todayISO(),
      type: item.type,
    });
    await db.saveTransaction(tx);

    // Sync account balance
    const accTxs = await db.getTransactions(item.accountId);
    const account = await db.getAccount(item.accountId);
    if (account) {
      const totalTxs = accTxs.reduce((sum, t) => sum + t.amount, 0);
      account.currentBalance = Math.round((account.startingBalance + totalTxs) * 100) / 100;
      account.updatedAt = Date.now();
      await db.saveAccount(account);
    }

    // Advance recurring start date past today
    const recurring = await db.getRecurringTransaction(item.recurringId);
    if (recurring) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      recurring.startDate = tomorrow.toISOString().split('T')[0];
      recurring.updatedAt = Date.now();
      await db.saveRecurringTransaction(recurring);
    }

    setActionItem(null);
    await refreshTransactions();
  };

  if (!activeAccount) return null;

  // Scheduled: manual entries always visible, recurring limited to before payday
  const allScheduled = useMemo(() => {
    // Manual scheduled entries are ALWAYS shown — user entered them, they should see them
    const manualItems = manualScheduled.map(tx => ({ ...tx, isRecurringAuto: false }));

    // Recurring auto-populated items: filter to before payday or 30-day fallback
    let recurringItems;
    if (effectivePayDate) {
      recurringItems = recurringScheduled.filter(item => item.date <= effectivePayDate);
    } else {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 30);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      recurringItems = recurringScheduled.filter(item => item.date <= cutoffStr);
    }

    const combined = [...manualItems, ...recurringItems];
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
    return combined;
  }, [manualScheduled, recurringScheduled, effectivePayDate]);

  // TilPaid balance: expenses only, before payday
  const scheduledExpensesTotal = useMemo(() => {
    let total = 0;
    for (const item of allScheduled) {
      const isExpense = item.type === 'expense' || (!item.type && item.amount < 0);
      if (!isExpense) continue;
      if (effectivePayDate && item.date > effectivePayDate) continue;
      total += item.amount;
    }
    return total;
  }, [allScheduled, effectivePayDate]);

  const tilPaidBalance = Math.round((actualBalance + scheduledExpensesTotal) * 100) / 100;

  // After payday
  const allScheduledTotal = allScheduled.reduce((sum, item) => sum + item.amount, 0);
  const afterPayday = Math.round((actualBalance + allScheduledTotal) * 100) / 100;
  const showAfterPayday = allScheduled.some(item => item.type === 'income' || (!item.type && item.amount > 0));

  const WARNING_THRESHOLD = warningThreshold;
  const tilPaidColor = tilPaidBalance < 0
    ? 'text-danger-500'
    : tilPaidBalance <= WARNING_THRESHOLD
      ? 'text-warning-500'
      : 'text-text';

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex justify-between items-center mb-2">
          <AccountSwitcher />
          <button
            onClick={() => navigate('/reconcile')}
            className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl bg-surface-card border border-border active:scale-95 transition-transform"
          >
            <CheckCircle size={14} className="text-text-secondary" />
            <span className="text-[8px] text-text-muted font-medium">Check</span>
          </button>
        </div>

        {/* Hero: TilPaid balance */}
        <div className="flex items-end justify-between mb-0.5">
          <p className={`text-[34px] font-bold tracking-tight leading-none ${tilPaidColor}`}>
            {formatCurrency(tilPaidBalance)}
          </p>
          {daysTilPay !== null && daysTilPay > 0 && (
            <p className="text-[12px] text-brand-500 font-semibold mb-1">{daysTilPay}d til pay</p>
          )}
          {daysTilPay === 0 && (
            <p className="text-[12px] text-success-500 font-semibold mb-1">Payday!</p>
          )}
        </div>
        <p className="text-[11px] text-brand-500 font-semibold tracking-wide">TilPaid</p>

        <div className="flex justify-between items-center mt-1.5 mb-3">
          <p className="text-[12px] text-text-muted">
            Bank balance: {formatCurrency(actualBalance)}
          </p>
          {showAfterPayday && (
            <p className={`text-[12px] ${afterPayday < 0 ? 'text-danger-400' : 'text-text-muted'}`}>
              After payday: {formatCurrency(afterPayday)}
            </p>
          )}
        </div>
      </div>

      {/* Ledger */}
      <div className="flex-1 px-4 pb-4">
        {transactionsWithBalances.length === 0 && recurringScheduled.length === 0 ? (
          <div>
            <div className="text-center py-10">
              <p className="text-text-muted text-sm">No transactions yet</p>
              <p className="text-text-muted text-xs mt-1">Tap Add to log your first expense</p>
            </div>
            <StartingBalanceLine account={activeAccount} />
          </div>
        ) : (
          <div>
            {/* Search */}
            {transactionsWithBalances.length >= 5 && (
              <div className="mb-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input type="text" placeholder="Search transactions..." value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 rounded-[10px] border border-border bg-surface-card text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted"><X size={12} /></button>
                  )}
                </div>
              </div>
            )}

            {/* Scheduled section */}
            {allScheduled.length > 0 && !searchQuery && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <CalendarClock size={12} className="text-brand-500" />
                  <p className="text-xs text-brand-600 uppercase tracking-wider font-medium">
                    Scheduled ({allScheduled.length})
                  </p>
                </div>
                {allScheduled.map((item) => {
                  if (item.isRecurringAuto) {
                    return (
                      <div key={item.id}
                        onClick={() => setActionItem(item)}
                        className="flex items-center gap-3 py-3 px-1 border-b border-dashed border-border-light bg-brand-50/20 cursor-pointer select-none"
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                          style={{ backgroundColor: '#3B82F610', color: '#3B82F6', border: '1px dashed #3B82F640' }}>
                          <CalendarClock size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.description}</p>
                          <p className="text-xs text-text-muted mt-0.5">
                            Recurring · {item.date}
                            {item.isApproximate && ' · Est.'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-medium ${item.type === 'income' ? 'text-success-500' : ''}`}>
                            {formatCurrency(item.amount)}
                            {item.isApproximate && (
                              <span className="text-[9px] text-text-muted font-normal ml-1">est.</span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return <TransactionCard key={item.id} transaction={item} isScheduled={true} />;
                })}
                <div className="border-b border-border mt-2 mb-3" />
              </div>
            )}

            {/* Recent section */}
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-2 px-1">
              {searchQuery ? 'Search results' : 'Recent transactions'}
            </p>
            {(() => {
              const txList = searchQuery ? transactionsWithBalances : recentTransactions;
              const filtered = txList.filter(tx => {
                if (!searchQuery) return true;
                return (tx.description || '').toLowerCase().includes(searchQuery.toLowerCase());
              });
              return filtered.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-6">No matching transactions</p>
              ) : (
                filtered.map((tx) => <TransactionCard key={tx.id} transaction={tx} />)
              );
            })()}
            <StartingBalanceLine account={activeAccount} />
          </div>
        )}
      </div>

      {/* Recurring action sheet */}
      {actionItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setActionItem(null)}>
          <div className="bg-surface-card w-full max-w-md rounded-t-2xl px-5 pt-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <p className="text-base font-semibold mb-1">{actionItem.description}</p>
            <p className="text-xs text-text-muted mb-5">
              {actionItem.type === 'income' ? 'Deposit' : 'Bill'} · Scheduled {actionItem.date} · {formatCurrency(actionItem.amount)}
            </p>

            <button
              onClick={() => handlePostEarly(actionItem)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[10px] bg-success-50 border border-success-200 mb-2 active:scale-[0.98] transition-transform"
            >
              <Zap size={18} className="text-success-600 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-success-700">Post early</p>
                <p className="text-[11px] text-success-600">
                  {actionItem.type === 'income' ? 'Deposit arrived' : 'Payment cleared'} — add to ledger now
                </p>
              </div>
            </button>

            <p className="text-[10px] text-text-muted text-center mb-3 px-2">
              To edit this recurring item, go to Upcoming → Manage
            </p>

            <button onClick={() => setActionItem(null)}
              className="w-full py-3 text-center text-sm text-text-muted font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

      <BottomNav />
      <OnboardingOverlay />
    </div>
  );
}
