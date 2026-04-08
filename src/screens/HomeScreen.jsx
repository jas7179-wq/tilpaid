import { useEffect, useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, generateUpcomingOccurrences, todayISO, daysUntil, createTransaction, getNextPayInfo, generatePayCycleScheduledItems, advancePayCycleDate } from '../lib/utils';
import * as db from '../lib/db';
import TransactionCard from '../components/TransactionCard';
import StartingBalanceLine from '../components/StartingBalanceLine';
import AccountSwitcher from '../components/AccountSwitcher';
import BottomNav from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';
import { Landmark, Search, X, CalendarClock, Zap } from 'lucide-react';
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
  const [postEarlyAmount, setPostEarlyAmount] = useState('');

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

  // Dynamic payday from scheduled paycheck or pay cycles
  const effectivePayInfo = useMemo(() => {
    const manualPaycheck = manualScheduled.find(tx => tx.categoryId === 'cat-paycheck');
    if (manualPaycheck) return { date: manualPaycheck.date, name: '' };
    const recurringPaycheck = recurringScheduled.find(item => item.categoryId === 'cat-paycheck');
    if (recurringPaycheck) return { date: recurringPaycheck.date, name: '' };
    // Use pay cycles from account
    if (activeAccount) {
      const info = getNextPayInfo(activeAccount);
      if (info) return info;
    }
    if (payDate) return { date: payDate, name: '' };
    return null;
  }, [manualScheduled, recurringScheduled, payDate, activeAccount]);

  const effectivePayDate = effectivePayInfo?.date || null;
  const effectivePayCycleName = effectivePayInfo?.cycleName || '';
  const daysTilPay = effectivePayDate ? daysUntil(effectivePayDate) : null;

  // Progress ring: days elapsed / total cycle length
  const progressRing = useMemo(() => {
    if (!activeAccount?.payCycles?.length || !effectivePayDate) return null;
    const cycle = activeAccount.payCycles.find(c => c.nextPayDate === effectivePayDate) || activeAccount.payCycles[0];
    if (!cycle?.frequency) return null;

    const cycleDays = { weekly: 7, biweekly: 14, 'semi-monthly': 15, monthly: 30 }[cycle.frequency] || 14;
    const daysLeft = daysTilPay || 0;
    const daysElapsed = cycleDays - daysLeft;
    const progress = Math.max(0, Math.min(1, daysElapsed / cycleDays));
    return { progress, daysLeft, cycleDays };
  }, [activeAccount, effectivePayDate, daysTilPay]);

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

      // De-duplicate: skip recurring items that already have a posted transaction
      const autoScheduled = allUpcoming
        .filter(item => {
          if (item.date < today) return false;
          const hasMatch = transactionsWithBalances.some(tx => {
            if (tx.isAdjustment) return false;
            // Exact match: tagged with same recurringId and occurrence date
            if (tx.recurringId === item.recurringId && tx.recurringOccurrenceDate === item.date) {
              return true;
            }
            // Fallback: match by description within 7 days (for manually entered items)
            if (tx.description?.toLowerCase() !== item.description?.toLowerCase()) return false;
            const txDate = new Date(tx.date);
            const itemDate = new Date(item.date);
            const daysDiff = Math.abs((txDate - itemDate) / (1000 * 60 * 60 * 24));
            return daysDiff <= 7;
          });
          return !hasMatch;
        })
        .map(item => ({ ...item, isRecurringAuto: true }));

      // Only show the next occurrence per recurring item (prevents posting multiple cycles)
      const seen = new Set();
      const nextOnly = autoScheduled.filter(item => {
        if (seen.has(item.recurringId)) return false;
        seen.add(item.recurringId);
        return true;
      });

      setRecurringScheduled(nextOnly);
    }
    loadRecurringForScheduled();
  }, [activeAccountId, currentBalance, transactionsWithBalances, today, payDate]);

  // Post early handler
  const handlePostEarly = async (item) => {
    const customAmount = postEarlyAmount ? parseFloat(postEarlyAmount) : Math.abs(item.amount);
    const tx = createTransaction({
      accountId: item.accountId,
      amount: customAmount,
      description: item.description,
      categoryId: item.categoryId,
      date: todayISO(),
      type: item.type,
    });
    // Tag with recurringId and the occurrence date so dedup can match precisely
    tx.recurringId = item.recurringId;
    tx.recurringOccurrenceDate = item.date;
    await db.saveTransaction(tx);

    // Sync account balance
    const accTxs = await db.getTransactions(item.accountId);
    const account = await db.getAccount(item.accountId);
    if (account) {
      const totalTxs = accTxs.reduce((sum, t) => sum + t.amount, 0);
      account.currentBalance = Math.round((account.startingBalance + totalTxs) * 100) / 100;

      // If this is a pay cycle generated paycheck, advance the cycle's next pay date
      if (item.isPayCycleGenerated && item.payCycleId && account.payCycles) {
        const cycle = account.payCycles.find(c => c.id === item.payCycleId);
        if (cycle) {
          const result = advancePayCycleDate(todayISO(), cycle.frequency);
          cycle.nextPayDate = result.date;
          // Keep legacy fields in sync
          const nearest = account.payCycles
            .filter(c => c.nextPayDate)
            .sort((a, b) => a.nextPayDate.localeCompare(b.nextPayDate))[0];
          if (nearest) {
            account.payFrequency = nearest.frequency;
            account.nextPayDate = nearest.nextPayDate;
          }
        }
      }

      account.updatedAt = Date.now();
      await db.saveAccount(account);
    }

    setActionItem(null);
    setPostEarlyAmount('');
    await refreshTransactions();
  };

  if (!activeAccount) return null;

  // Scheduled: manual entries always visible, recurring limited to before payday
  const allScheduled = useMemo(() => {
    const manualItems = manualScheduled.map(tx => ({ ...tx, isRecurringAuto: false }));

    let recurringItems;
    if (effectivePayDate) {
      recurringItems = recurringScheduled.filter(item => item.date <= effectivePayDate);
    } else {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 30);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      recurringItems = recurringScheduled.filter(item => item.date <= cutoffStr);
    }

    // Premium: auto-generate scheduled paychecks from pay cycles with amounts
    let payCycleItems = [];
    if (isPremium && activeAccount) {
      payCycleItems = generatePayCycleScheduledItems(activeAccount);
      // Dedup: skip pay cycle items if there's already a manual or recurring paycheck on the same date
      payCycleItems = payCycleItems.filter(pcItem => {
        const hasManual = manualItems.some(tx =>
          tx.categoryId === 'cat-paycheck' && tx.date === pcItem.date
        );
        const hasRecurring = recurringItems.some(item =>
          item.categoryId === 'cat-paycheck' && item.date === pcItem.date
        );
        return !hasManual && !hasRecurring;
      });

      // Only show the nearest paycheck, unless another is within 3 days of it
      if (payCycleItems.length > 1) {
        payCycleItems.sort((a, b) => a.date.localeCompare(b.date));
        const nearest = payCycleItems[0];
        const nearestDate = new Date(nearest.date);
        payCycleItems = payCycleItems.filter(item => {
          const daysDiff = Math.abs((new Date(item.date) - nearestDate) / (1000 * 60 * 60 * 24));
          return daysDiff <= 3;
        });
      }
    }

    const combined = [...manualItems, ...recurringItems, ...payCycleItems];
    // Sort by date descending, but on same day: expenses before income
    combined.sort((a, b) => {
      const dateCompare = new Date(b.date) - new Date(a.date);
      if (dateCompare !== 0) return dateCompare;
      const aIsIncome = a.type === 'income' || (!a.type && a.amount > 0);
      const bIsIncome = b.type === 'income' || (!b.type && b.amount > 0);
      if (aIsIncome && !bIsIncome) return 1;
      if (!aIsIncome && bIsIncome) return -1;
      return 0;
    });
    return combined;
  }, [manualScheduled, recurringScheduled, effectivePayDate, isPremium, activeAccount]);

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

  // Balance pop animation
  const balanceRef = useRef(null);
  const prevBalance = useRef(null);
  useEffect(() => {
    if (prevBalance.current !== null && prevBalance.current !== tilPaidBalance && balanceRef.current) {
      balanceRef.current.classList.remove('balance-pop');
      void balanceRef.current.offsetWidth;
      balanceRef.current.classList.add('balance-pop');
    }
    prevBalance.current = tilPaidBalance;
  }, [tilPaidBalance]);

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
      {/* ── Header ── */}
      <div className="hero-gradient px-5 pt-5 pb-3 rounded-b-[20px] relative overflow-hidden">
        {/* Subtle background texture for premium feel */}
        <div 
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ 
            backgroundImage: 'radial-gradient(circle at 30% 20%, #4A8B3F 0%, transparent 60%)'
          }} 
        />

        {/* Top row: account + verify */}
        <div className="flex justify-between items-center mb-4">
          <AccountSwitcher />
          <button
            onClick={() => navigate('/reconcile')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/60 border border-white/40 backdrop-blur-md"
          >
            <Landmark size={12} className="text-text-muted" />
            <span className="text-[10px] text-text-muted font-medium">Verify</span>
          </button>
        </div>

        {/* Hero balance + progress ring row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p ref={balanceRef} className={`text-[42px] font-bold tracking-[-2px] leading-none ${tilPaidColor}`}>
              {formatCurrency(tilPaidBalance)}
            </p>
            <p className="text-[11px] text-text-muted mt-1 font-medium">TilPaid Balance</p>
          </div>

          {/* Progress ring stays exactly as Claude wrote it */}
          {progressRing && daysTilPay !== null && daysTilPay > 0 && (
            <div className="relative flex items-center justify-center w-16 h-16 shrink-0">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#DDE6D6" strokeWidth="4" />
                <circle 
                  cx="32" 
                  cy="32" 
                  r="28" 
                  fill="none" 
                  stroke="#4A8B3F" 
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="progress-ring-circle"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressRing.progress)}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[16px] font-bold text-brand-700 leading-none">{progressRing.daysLeft}</span>
                <span className="text-[8px] text-text-muted font-medium">{progressRing.daysLeft === 1 ? 'day' : 'days'}</span>
              </div>
            </div>
          )}

          {/* Payday celebration */}
          {daysTilPay === 0 && (
            <div className="w-16 h-16 rounded-full bg-success-50 border-2 border-success-500 flex items-center justify-center shrink-0">
              <span className="text-lg">🎉</span>
            </div>
          )}
        </div>

        {/* Pay cycle name */}
        {effectivePayCycleName && daysTilPay !== null && daysTilPay > 0 && (
          <p className="text-[10px] text-text-muted -mt-2 mb-2">{effectivePayCycleName}'s payday</p>
        )}

        {/* Info cards — glassmorphic style */}
        <div className="flex gap-2 mb-1">
          <div className="flex-1 bg-white/70 rounded-[12px] border border-white/40 px-3 py-2.5 backdrop-blur-md">
            <p className="text-[10px] text-text-muted">Bank</p>
            <p className="text-[15px] font-bold mt-0.5">{formatCurrency(actualBalance)}</p>
          </div>
          {showAfterPayday && (
            <div className="flex-1 bg-white/70 rounded-[12px] border border-white/40 px-3 py-2.5 backdrop-blur-md">
              <p className="text-[10px] text-text-muted">After payday</p>
              <p className={`text-[15px] font-bold mt-0.5 ${afterPayday < 0 ? 'text-danger-500' : ''}`}>
                {formatCurrency(afterPayday)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Ledger ── */}
      <div className="flex-1 px-4 pb-4">
        {transactionsWithBalances.length === 0 && recurringScheduled.length === 0 && allScheduled.length === 0 ? (
          <div>
            <div className="text-center py-10 px-6">
              {/* Empty state illustration */}
              <div className="mx-auto mb-5 w-20 h-20 relative">
                <div className="w-20 h-20 rounded-2xl bg-brand-50 border border-brand-200/50 flex items-center justify-center">
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="8" width="28" height="22" rx="4" stroke="#4A8B3F" strokeWidth="1.5" strokeDasharray="3 2" fill="#EEF4E810"/>
                    <line x1="10" y1="15" x2="26" y2="15" stroke="#B0CFA0" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="10" y1="20" x2="22" y2="20" stroke="#D4E4C8" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="10" y1="25" x2="18" y2="25" stroke="#D4E4C8" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="27" cy="10" r="6" fill="#4A8B3F"/>
                    <line x1="27" y1="7.5" x2="27" y2="12.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="24.5" y1="10" x2="29.5" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              <p className="text-text-secondary text-sm font-medium mb-1">Your clean slate</p>
              <p className="text-text-muted text-xs leading-relaxed">
                Tap the <span className="text-brand-500 font-medium">+</span> button to log your first expense
              </p>
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
                    const isIncome = item.type === 'income' || (!item.type && item.amount > 0);
                    return (
                      <div
                        key={item.id}
                        onClick={() => { setActionItem(item); setPostEarlyAmount(Math.abs(item.amount).toFixed(2)); }}
                        className={`flex items-center gap-3 py-3 px-3 mb-1.5 rounded-[12px] cursor-pointer select-none border shadow-sm ${
                          isIncome
                            ? 'bg-emerald-50/70 border-emerald-100' 
                            : 'bg-rose-50 border-rose-200'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${
                          isIncome ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-600'
                        }`}>
                          <CalendarClock size={18} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.description}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {item.date}
                            {item.isApproximate && ' · Est.'}
                          </p>
                          {isIncome && (
                            <p className="text-[9px] text-text-muted mt-0.5 italic">
                              Not counted in TilPaid balance
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`text-[14px] font-bold ${
                            isIncome ? 'text-emerald-700' : 'text-rose-600'
                          }`}>
                            {formatCurrency(item.amount)}
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
            <div className="mb-6">
              <div className="flex items-center justify-between px-1 mb-3">
                <p className="text-xs text-text-secondary uppercase tracking-wider font-medium">
                  {searchQuery ? 'Search results' : 'Recent'}
                </p>
                
                {!searchQuery && recentTransactions.length > 4 && (
                  <button 
                    onClick={() => {/* TODO: navigate to full ledger */}}
                    className="text-xs font-medium text-brand-600 flex items-center gap-1 hover:text-brand-700 transition-colors"
                  >
                    See all <span className="text-[10px]">→</span>
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {(() => {
                  const txList = searchQuery ? transactionsWithBalances : recentTransactions;
                  const filtered = txList.filter(tx => {
                    if (!searchQuery) return true;
                    return (tx.description || '').toLowerCase().includes(searchQuery.toLowerCase());
                  });

                  return filtered.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">
                      No matching transactions
                    </p>
                  ) : (
                    filtered.map((tx) => (
                      <TransactionCard 
                        key={tx.id} 
                        transaction={tx} 
                        compact={true}
                      />
                    ))
                  );
                })()}
              </div>
            </div>

            <StartingBalanceLine account={activeAccount} />
          </div>
        )}
      </div>

      {/* Recurring action sheet */}
      {actionItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-5 overlay-enter" onClick={() => { setActionItem(null); setPostEarlyAmount(''); }}>
          <div className="bg-surface-card w-full max-w-sm rounded-2xl px-5 pt-5 pb-4 shadow-xl sheet-enter" onClick={e => e.stopPropagation()}>
            <p className="text-base font-semibold mb-1">{actionItem.description}</p>
            <p className="text-xs text-text-muted mb-3">
              {actionItem.type === 'income' ? 'Deposit' : 'Bill'} · Scheduled {actionItem.date} · {formatCurrency(actionItem.amount)}
            </p>

            {/* Editable amount */}
            <div className="mb-3">
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
                {actionItem.isApproximate ? 'Adjust amount' : 'Amount'}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-muted">{actionItem.type === 'expense' ? '-$' : '+$'}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={postEarlyAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setPostEarlyAmount(val);
                  }}
                  className="flex-1 px-3 py-2 rounded-[10px] border border-border bg-surface text-sm font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border"
                />
              </div>
              {actionItem.isApproximate && (
                <p className="text-[10px] text-text-muted mt-1">This was an estimate — enter the actual amount</p>
              )}
            </div>

            <button
              onClick={() => handlePostEarly(actionItem)}
              disabled={!postEarlyAmount || parseFloat(postEarlyAmount) === 0}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[10px] bg-success-50 border border-success-200 mb-2 disabled:opacity-40"
            >
              <Zap size={18} className="text-success-600 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-success-700">Post early</p>
                <p className="text-[11px] text-success-600">
                  {actionItem.type === 'income' ? 'Deposit arrived' : 'Payment cleared'} — add to ledger now
                </p>
              </div>
            </button>

            <p className="text-[10px] text-text-muted text-center mb-2 px-2">
              To edit this recurring item, go to Recurring → Manage
            </p>

            <button onClick={() => { setActionItem(null); setPostEarlyAmount(''); }}
              className="w-full py-2.5 text-center text-sm text-text-muted font-medium">
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
