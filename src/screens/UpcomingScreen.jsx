import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, daysUntil, generateUpcomingOccurrences, todayISO, createTransaction, generatePayCycleScheduledItems, advancePayCycleDate } from '../lib/utils';
import * as db from '../lib/db';
import BottomNav from '../components/BottomNav';
import { Plus, Trash2, Calendar, Repeat, AlertTriangle, Check, X, Clock, CalendarDays, ListFilter } from 'lucide-react';
import CalendarView from '../components/CalendarView';

export default function UpcomingScreen() {
  const { accounts, activeAccountId, currentBalance, isPremium, refreshTransactions } = useApp();
  const navigate = useNavigate();

  const [recurringList, setRecurringList] = useState([]);
  const [upcomingItems, setUpcomingItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showTab, setShowTab] = useState('upcoming');
  const [filterAccountId, setFilterAccountId] = useState('all');

  // Verify modal state
  const [verifyItem, setVerifyItem] = useState(null);
  const [verifyAmount, setVerifyAmount] = useState('');

  useEffect(() => {
    loadData();
  }, [accounts]);

  async function loadData() {
    if (!accounts.length) return;
    const cats = await db.getCategories();
    setCategories(cats);

    let allRecurring = [];
    for (const acc of accounts) {
      const recurring = await db.getRecurringTransactions(acc.id);
      allRecurring = [...allRecurring, ...recurring];
    }
    setRecurringList(allRecurring);
    await rebuildUpcoming(allRecurring, filterAccountId);
  }

  const rebuildUpcoming = async (recurring, accountFilter) => {
    const filtered = accountFilter === 'all'
      ? recurring.filter(r => r.isActive)
      : recurring.filter(r => r.isActive && r.accountId === accountFilter);

    const allUpcoming = filtered.flatMap(r => generateUpcomingOccurrences(r, 65));

    // Inject pay cycle paychecks (Premium: from account pay cycles with amounts)
    const relevantAccounts = accountFilter === 'all'
      ? accounts
      : accounts.filter(a => a.id === accountFilter);

    for (const acc of relevantAccounts) {
      if (!acc.payCycles) continue;
      for (const cycle of acc.payCycles) {
        if (!cycle.nextPayDate || !cycle.frequency) continue;
        const amount = cycle.amount || 0;
        const name = cycle.name ? `${cycle.name} Paycheck` : 'Paycheck';

        // Generate multiple occurrences for the look-ahead window
        let dateObj = new Date(cycle.nextPayDate + 'T00:00:00');
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 65);

        while (dateObj <= endDate) {
          const dateStr = dateObj.toISOString().split('T')[0];
          const daysOut = daysUntil(dateStr);

          if (daysOut > 0) {
            allUpcoming.push({
              id: `paycycle-${cycle.id}-${dateStr}`,
              recurringId: `paycycle-${cycle.id}`,
              accountId: acc.id,
              description: name,
              amount: amount,
              type: 'income',
              date: dateStr,
              categoryId: 'cat-paycheck',
              isPayCycleGenerated: true,
              payCycleId: cycle.id,
              daysOut,
              isApproximate: false,
              isAutoDraft: false,
            });
          }

          // Advance to next occurrence
          switch (cycle.frequency) {
            case 'weekly': dateObj.setDate(dateObj.getDate() + 7); break;
            case 'biweekly': dateObj.setDate(dateObj.getDate() + 14); break;
            case 'semi-monthly': {
              const d = dateObj.getDate();
              if (d < 15) dateObj.setDate(15);
              else { dateObj.setMonth(dateObj.getMonth() + 1); dateObj.setDate(1); }
              break;
            }
            case 'monthly': dateObj.setMonth(dateObj.getMonth() + 1); break;
            default: dateObj.setDate(dateObj.getDate() + 14);
          }
        }
      }
    }

    // Load all transactions to dedup against posted items
    const allTransactions = [];
    for (const acc of accounts) {
      const txs = await db.getTransactions(acc.id);
      allTransactions.push(...txs);
    }

    // Filter out occurrences that have already been posted
    const deduped = allUpcoming.filter(item => {
      const hasMatch = allTransactions.some(tx => {
        if (tx.isAdjustment) return false;
        // Exact match: tagged with same recurringId and occurrence date
        if (tx.recurringId === item.recurringId && tx.recurringOccurrenceDate === item.date) {
          return true;
        }
        // Fallback: match by description within 7 days
        if (tx.description?.toLowerCase() !== item.description?.toLowerCase()) return false;
        const txDate = new Date(tx.date);
        const itemDate = new Date(item.date);
        const daysDiff = Math.abs((txDate - itemDate) / (1000 * 60 * 60 * 24));
        return daysDiff <= 7;
      });
      return !hasMatch;
    });

    // Add daysOut for items that don't have it
    const today = todayISO();
    deduped.forEach(item => {
      if (item.daysOut === undefined) {
        item.daysOut = daysUntil(item.date);
      }
    });

    deduped.sort((a, b) => new Date(a.date) - new Date(b.date));
    setUpcomingItems(deduped);
  };

  const handleFilterChange = async (accountId) => {
    setFilterAccountId(accountId);
    await rebuildUpcoming(recurringList, accountId);
  };

  const getCat = (catId) => categories.find(c => c.id === catId);
  const getAccountName = (accId) => accounts.find(a => a.id === accId)?.name || '';

  const handleDelete = async (id) => {
    if (!confirm('Delete this recurring transaction?')) return;
    await db.deleteRecurringTransaction(id);
    const updated = recurringList.filter(r => r.id !== id);
    setRecurringList(updated);
    await rebuildUpcoming(updated, filterAccountId);
  };

  // Open verify modal
  const handleVerifyOpen = (item, e) => {
    e.stopPropagation();
    setVerifyItem(item);
    setVerifyAmount(Math.abs(item.amount).toFixed(2));
  };

  // Confirm verify — post to ledger as actual transaction
  const handleVerifyConfirm = async () => {
    if (!verifyItem) return;

    const amountNum = parseFloat(verifyAmount);
    if (isNaN(amountNum) || amountNum === 0) return;

    // Create a real transaction from the recurring item
    const tx = createTransaction({
      accountId: verifyItem.accountId,
      amount: amountNum,
      description: verifyItem.description,
      categoryId: verifyItem.categoryId,
      date: verifyItem.date,
      type: verifyItem.type,
    });
    // Tag with recurringId and occurrence date for precise dedup
    tx.recurringId = verifyItem.recurringId;
    tx.recurringOccurrenceDate = verifyItem.date;

    await db.saveTransaction(tx);

    // Sync the account balance
    const accTxs = await db.getTransactions(verifyItem.accountId);
    const account = await db.getAccount(verifyItem.accountId);
    if (account) {
      const totalTxs = accTxs.reduce((sum, t) => sum + t.amount, 0);
      account.currentBalance = Math.round((account.startingBalance + totalTxs) * 100) / 100;
      account.updatedAt = Date.now();
      await db.saveAccount(account);
    }

    setVerifyItem(null);
    setVerifyAmount('');

    // Refresh everything
    await refreshTransactions();
    await loadData();
  };

  // Calculate projected balance
  const relevantBalance = filterAccountId === 'all'
    ? accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
    : (accounts.find(a => a.id === filterAccountId)?.currentBalance || 0);

  const projectedBalance = upcomingItems.reduce((bal, item) => bal + item.amount, relevantBalance);
  const totalBills = upcomingItems.filter(i => i.type === 'expense').reduce((sum, i) => sum + i.amount, 0);
  const totalDeposits = upcomingItems.filter(i => i.type === 'income').reduce((sum, i) => sum + i.amount, 0);

  // Group upcoming by week
  const today = todayISO();
  const groupedByWeek = {};
  upcomingItems.forEach(item => {
    const days = item.daysOut;
    let weekLabel;
    if (days <= 0) weekLabel = 'Due today';
    else if (days <= 7) weekLabel = 'This week';
    else if (days <= 14) weekLabel = 'Next week';
    else if (days <= 21) weekLabel = 'In 2 weeks';
    else if (days <= 28) weekLabel = 'In 3 weeks';
    else weekLabel = 'In 4+ weeks';
    if (!groupedByWeek[weekLabel]) groupedByWeek[weekLabel] = [];
    groupedByWeek[weekLabel].push(item);
  });

  // Count items needing verification (due today or within 5 days)
  const needsVerifyCount = upcomingItems.filter(i => i.daysOut <= 5 && i.type === 'expense').length;

  const filteredRecurring = filterAccountId === 'all'
    ? recurringList
    : recurringList.filter(r => r.accountId === filterAccountId);

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <div className="flex-1 px-5 py-5">
          <h1 className="text-2xl font-semibold mb-2">Recurring</h1>
          <p className="text-sm text-text-secondary mb-8">See what's ahead between paychecks</p>
          <div className="bg-gradient-to-br from-brand-50 to-success-50 rounded-[14px] border border-brand-100 p-6 text-center">
            <Calendar size={32} className="text-brand-500 mx-auto mb-3" />
            <p className="text-base font-semibold text-brand-700 mb-2">Unlock look-ahead view</p>
            <p className="text-sm text-brand-600 leading-relaxed mb-4">
              Set up recurring bills and deposits to see what's coming, when it's due, and your projected balance.
            </p>
            <button className="w-full py-2.5 rounded-[10px] bg-brand-500 text-white text-sm font-medium">
              Upgrade to Premium
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="flex-1 px-5 py-5">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Recurring</h1>
            {needsVerifyCount > 0 && (
              <p className="text-xs text-warning-600 font-medium mt-0.5">
                {needsVerifyCount} item{needsVerifyCount > 1 ? 's' : ''} to verify
              </p>
            )}
          </div>
          <button onClick={() => navigate('/add-recurring')}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 border border-brand-200">
            <Plus size={12} /> Add
          </button>
        </div>

        {/* Account filter */}
        {accounts.length > 1 && (
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            <button onClick={() => handleFilterChange('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filterAccountId === 'all' ? 'bg-brand-500 text-white' : 'bg-surface-card border border-border text-text-secondary'
              }`}>All accounts</button>
            {accounts.map((acc) => (
              <button key={acc.id} onClick={() => handleFilterChange(acc.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filterAccountId === acc.id ? 'bg-brand-500 text-white' : 'bg-surface-card border border-border text-text-secondary'
                }`}>{acc.name}</button>
            ))}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-surface-card rounded-[10px] border border-border p-3 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Bills</p>
            <p className="text-sm font-semibold text-danger-500 mt-0.5">{formatCurrency(totalBills)}</p>
          </div>
          <div className="bg-surface-card rounded-[10px] border border-border p-3 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Deposits</p>
            <p className="text-sm font-semibold text-success-500 mt-0.5">{formatCurrency(totalDeposits)}</p>
          </div>
          <div className="bg-surface-card rounded-[10px] border border-border p-3 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Projected</p>
            <p className={`text-sm font-semibold mt-0.5 ${
              projectedBalance < 0 ? 'text-danger-500' : projectedBalance <= 250 ? 'text-warning-500' : 'text-text'
            }`}>{formatCurrency(projectedBalance)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-4">
          <button onClick={() => setShowTab('upcoming')}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              showTab === 'upcoming' ? 'border-brand-500 text-brand-600' : 'border-transparent text-text-muted'
            }`}>
            List
            {needsVerifyCount > 0 && (
              <span className="ml-1.5 inline-flex w-5 h-5 rounded-full bg-warning-500 text-white text-[10px] font-bold items-center justify-center">
                {needsVerifyCount}
              </span>
            )}
          </button>
          <button onClick={() => setShowTab('calendar')}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              showTab === 'calendar' ? 'border-brand-500 text-brand-600' : 'border-transparent text-text-muted'
            }`}>
            Calendar
          </button>
          <button onClick={() => setShowTab('manage')}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              showTab === 'manage' ? 'border-brand-500 text-brand-600' : 'border-transparent text-text-muted'
            }`}>Manage ({filteredRecurring.length})</button>
        </div>

        {/* Upcoming tab */}
        {showTab === 'upcoming' && (
          <div>
            {upcomingItems.length === 0 ? (
              <div className="text-center py-12">
                <Repeat size={24} className="text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">No recurring bills or deposits</p>
                <button onClick={() => navigate('/add-recurring')} className="mt-3 text-sm text-brand-500 font-medium">
                  Add your first one
                </button>
              </div>
            ) : (
              Object.entries(groupedByWeek).map(([weekLabel, items]) => (
                <div key={weekLabel} className="mb-4">
                  <p className={`text-xs uppercase tracking-wider mb-2 px-1 ${
                    weekLabel === 'Due today' ? 'text-warning-600 font-semibold' : 'text-text-secondary'
                  }`}>{weekLabel}</p>
                  {items.map((item) => {
                    const cat = getCat(item.categoryId);
                    const color = cat?.color || '#6B7280';
                    const isIncome = item.type === 'income';
                    const accName = accounts.length > 1 ? getAccountName(item.accountId) : '';
                    const isDue = item.daysOut <= 0;
                    const isDueSoon = !isDue && item.daysOut <= 5 && item.type === 'expense';
                    const canVerify = isDue || isDueSoon;

                    return (
                      <div key={item.id}
                        className={`flex items-center gap-3 py-3 px-2 border-b border-border-light rounded-lg mb-0.5 ${
                          isDue ? 'bg-warning-50 border-warning-200'
                            : isDueSoon ? 'bg-blue-50/50 border-blue-100' : ''
                        }`}
                      >
                        {/* Left: avatar */}
                        <div
                          onClick={() => navigate(`/edit-recurring/${item.recurringId}`)}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0 cursor-pointer"
                          style={{
                            backgroundColor: isDue ? '#F59E0B18' : isDueSoon ? '#4A8B3F12' : `${color}12`,
                            color: isDue ? '#D97706' : isDueSoon ? '#2563EB' : color,
                            border: isDue ? '1.5px solid #F59E0B50' : isDueSoon ? '1.5px solid #4A8B3F30' : `1px dashed ${color}40`,
                          }}>
                          {isDue
                            ? <AlertTriangle size={14} />
                            : isDueSoon
                              ? <Clock size={14} />
                              : (item.description?.charAt(0)?.toUpperCase() || '?')
                          }
                        </div>

                        {/* Middle: info (tap to edit) */}
                        <div
                          onClick={() => navigate(`/edit-recurring/${item.recurringId}`)}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <p className="text-sm font-medium truncate">{item.description}</p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {cat?.name || 'Uncategorized'}
                            {accName && ` · ${accName}`}
                            {' · '}{formatDate(item.date)}
                            {item.daysOut > 0 && ` (${item.daysOut}d)`}
                          </p>
                        </div>

                        {/* Right: amount + verify button */}
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div>
                            <p className={`text-sm font-medium ${isIncome ? 'text-success-500' : ''}`}>
                              {formatCurrency(item.amount)}
                              {item.isApproximate && (
                                <span className="text-[9px] text-text-muted font-normal ml-1">est.</span>
                              )}
                            </p>
                            <p className="text-[10px] text-text-muted mt-0.5">
                              {isDue ? (
                                <span className="text-warning-600 font-medium">Needs verify</span>
                              ) : isDueSoon ? (
                                <span className="text-blue-500 font-medium">Due soon</span>
                              ) : item.isPayCycleGenerated ? (
                                'Pay cycle'
                              ) : (
                                item.isAutoDraft ? 'Auto' : 'Manual'
                              )}
                            </p>
                          </div>
                          {canVerify && (
                            <button
                              onClick={(e) => handleVerifyOpen(item, e)}
                              className={`w-8 h-8 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform ${
                                isDue ? 'bg-warning-500' : 'bg-blue-400'
                              }`}
                              title="Verify & post"
                            >
                              <Check size={14} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {/* Manage tab */}
        {showTab === 'manage' && (
          <div>
            {/* Pay cycle paychecks (from account settings) */}
            {(() => {
              const relevantAccts = filterAccountId === 'all'
                ? accounts
                : accounts.filter(a => a.id === filterAccountId);
              const payCycleEntries = [];
              for (const acc of relevantAccts) {
                if (!acc.payCycles) continue;
                for (const cycle of acc.payCycles) {
                  if (!cycle.frequency || !cycle.nextPayDate) continue;
                  payCycleEntries.push({ ...cycle, accountId: acc.id, accountName: acc.name });
                }
              }
              if (payCycleEntries.length > 0) {
                return (
                  <div className="mb-3">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 px-1">Paychecks (from account settings)</p>
                    {payCycleEntries.map((cycle) => {
                      const freqLabel = { weekly: 'Weekly', biweekly: 'Every 2 wks', monthly: 'Monthly', 'semi-monthly': '1st & 15th' }[cycle.frequency] || cycle.frequency;
                      return (
                        <div key={cycle.id} className="flex items-center gap-3 py-3 px-1 border-b border-border-light">
                          <div onClick={() => navigate('/settings')}
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-xs font-medium shrink-0"
                              style={{ backgroundColor: '#1D9E7515', color: '#1D9E75' }}>
                              {cycle.name?.charAt(0)?.toUpperCase() || '$'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{cycle.name ? `${cycle.name} Paycheck` : 'Paycheck'}</p>
                              <p className="text-xs text-text-muted mt-0.5">
                                {freqLabel} · Next: {cycle.nextPayDate}
                                {accounts.length > 1 ? ` · ${cycle.accountName}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {cycle.amount ? (
                              <p className="text-sm font-medium text-success-500">{formatCurrency(cycle.amount)}</p>
                            ) : (
                              <p className="text-[10px] text-text-muted">No amount</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[9px] text-text-muted text-center mt-1.5">Edit paychecks in Settings → Account</p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Recurring bills */}
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 px-1">Bills & recurring expenses</p>
            {filteredRecurring.filter(r => r.type !== 'income').length === 0 && filteredRecurring.filter(r => r.type === 'income').length === 0 ? (
              <div className="text-center py-8">
                <Repeat size={24} className="text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">No recurring bills</p>
                <button onClick={() => navigate('/add-recurring')} className="mt-3 text-sm text-brand-500 font-medium">
                  Add your first one
                </button>
              </div>
            ) : (
              filteredRecurring.map((r) => {
                const cat = getCat(r.categoryId);
                const color = cat?.color || '#6B7280';
                const isIncome = r.type === 'income';
                const freqLabel = { weekly: 'Weekly', biweekly: 'Every 2 wks', monthly: 'Monthly', 'semi-monthly': '1st & 15th' }[r.frequency] || r.frequency;
                const accName = accounts.length > 1 ? getAccountName(r.accountId) : '';

                return (
                  <div key={r.id} className="flex items-center gap-3 py-3 px-1 border-b border-border-light">
                    <div onClick={() => navigate(`/edit-recurring/${r.id}`)}
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-xs font-medium shrink-0"
                        style={{ backgroundColor: `${color}15`, color }}>
                        {r.description?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.description}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {freqLabel} · {isIncome ? 'Deposit' : 'Bill'}
                          {r.isAutoDraft ? ' · Auto' : ''}
                          {r.isApproximate ? ' · Est.' : ''}
                          {accName ? ` · ${accName}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`text-sm font-medium ${isIncome ? 'text-success-500' : ''}`}>
                        {formatCurrency(r.amount)}
                      </p>
                      <button onClick={() => handleDelete(r.id)}
                        className="p-1.5 text-text-muted hover:text-danger-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Calendar tab */}
        {showTab === 'calendar' && (
          <CalendarView
            upcomingItems={upcomingItems}
            currentBalance={relevantBalance}
            categories={categories}
            accounts={accounts}
            onItemTap={(recurringId) => navigate(`/edit-recurring/${recurringId}`)}
          />
        )}
      </div>

      {/* Verify modal */}
      {verifyItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center px-5 pt-[15vh] overlay-enter" onClick={() => { setVerifyItem(null); setVerifyAmount(''); }}>
          <div className="bg-surface-card w-full max-w-sm rounded-2xl px-5 pt-5 pb-5 shadow-xl sheet-enter" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold">Verify & post to ledger</h3>
              <button onClick={() => { setVerifyItem(null); setVerifyAmount(''); }}
                className="p-1 text-text-muted"><X size={18} /></button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-text-secondary">{verifyItem.description}</p>
              <p className="text-xs text-text-muted mt-0.5">
                Due {formatDate(verifyItem.date)} · {getAccountName(verifyItem.accountId)}
              </p>
            </div>

            <div className="mb-5">
              <label className="text-xs text-text-secondary block mb-1.5">
                Confirm amount {verifyItem.isApproximate && '(was estimated)'}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-lg text-text-secondary">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={verifyAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setVerifyAmount(val);
                  }}
                  className="flex-1 px-4 py-3 rounded-[10px] border border-border bg-white text-lg font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border"
                  autoFocus
                />
              </div>
              {verifyItem.isApproximate && (
                <p className="text-[11px] text-warning-600 mt-1.5">
                  This was an estimated amount — update it to match your actual statement.
                </p>
              )}
            </div>

            <button onClick={handleVerifyConfirm}
              className="w-full py-3.5 rounded-[10px] bg-success-500 text-white text-[15px] font-medium">
              Post {verifyItem.type === 'income' ? 'deposit' : 'payment'} to ledger
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
