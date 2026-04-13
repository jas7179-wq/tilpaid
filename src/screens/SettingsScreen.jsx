import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { generateId, formatCurrency } from '../lib/utils';
import * as db from '../lib/db';
import * as api from '../lib/api';
import * as sync from '../lib/sync';
import BottomNav from '../components/BottomNav';
import { Plus, Pencil, Trash2, X, Check, RotateCcw, Download, Cloud, CloudOff, RefreshCw, LogOut, ChevronLeft } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const PRESET_COLORS = [
  '#993556', '#BA7517', '#1D9E75', '#D85A30', '#378ADD',
  '#534AB7', '#E24B4A', '#5F5E5A', '#0F6E56', '#6B7280',
];

const PAY_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semi-monthly', label: '1st & 15th' },
  { value: 'monthly', label: 'Monthly' },
];

const RESET_DURATIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

const ACCOUNT_TYPES = [
  { type: 'checking', label: 'Checking' },
  { type: 'savings', label: 'Savings' },
  { type: 'money-market', label: 'Money Market' },
];

// ── Inline SVG Icons for Auth Buttons ──

function AppleLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

function GoogleLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function SettingsScreen() {
  const { categories, activeAccount, payFrequency, nextPayDate, resetAccount, accounts, deleteAccountById, canAddAccount, isPremium } = useApp();
  const navigate = useNavigate();
  const [editingCat, setEditingCat] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [localCategories, setLocalCategories] = useState(categories);

  // Per-account editing state
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [localAccountType, setLocalAccountType] = useState('');
  const [localAccountName, setLocalAccountName] = useState('');
  const [localPayCycles, setLocalPayCycles] = useState([]);

  // Envelope editing state
  const [localEnvelopes, setLocalEnvelopes] = useState([]);
  const [showEnvelopeEditor, setShowEnvelopeEditor] = useState(false);

  // Reset state
  const [showReset, setShowReset] = useState(false);
  const [resetBalance, setResetBalance] = useState('');

  // Auth state
  const [isSignedIn, setIsSignedIn] = useState(api.isAuthenticated());
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(sync.getSyncStatus());
  const [isSyncing, setIsSyncing] = useState(false);

  // Confirm modal states
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, title: '', message: '', confirmWord: null, confirmLabel: '' });

  const openConfirm = (opts) => setConfirmModal({ isOpen: true, ...opts });
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false, action: null }));
  const handleConfirmAction = async () => {
    if (confirmModal.action) await confirmModal.action();
    closeConfirm();
  };

  // ── Auth Handlers ──

  const handleAppleSignIn = async () => {
    setAuthLoading(true);
    try {
      // Apple Sign In via Sign In with Apple JS SDK
      // This will be wired up when Apple Developer credentials are ready
      // For now, show a placeholder
      alert('Apple Sign In will be available soon — waiting on developer account setup.');
    } catch (err) {
      console.error('Apple sign-in failed:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      // Google Sign In via Google Identity Services
      // This will be wired up when Google OAuth credentials are ready
      // For now, show a placeholder
      alert('Google Sign In will be available soon — waiting on developer account setup.');
    } catch (err) {
      console.error('Google sign-in failed:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    api.signOut();
    setIsSignedIn(false);
    setUserProfile(null);
    setSyncStatus(sync.getSyncStatus());
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await sync.initialSync();
      setSyncStatus(sync.getSyncStatus());
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Format last sync time
  const formatSyncTime = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // CSV Export
  const handleExportCSV = async () => {
    const allTxs = [];
    for (const acc of accounts) {
      const txs = await db.getTransactions(acc.id);
      txs.forEach(tx => {
        const cat = categories.find(c => c.id === tx.categoryId);
        allTxs.push({
          Account: acc.name,
          Date: tx.date,
          Description: tx.description || '',
          Category: cat?.name || 'Uncategorized',
          Type: tx.type || (tx.amount >= 0 ? 'income' : 'expense'),
          Amount: tx.amount.toFixed(2),
        });
      });
    }

    if (allTxs.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const headers = ['Account', 'Date', 'Description', 'Category', 'Type', 'Amount'];
    const csvRows = [headers.join(',')];
    allTxs.forEach(row => {
      csvRows.push(headers.map(h => {
        const val = String(row[h] || '');
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tilpaid-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveCategory = async (cat) => {
    await db.saveCategory(cat);
    setLocalCategories((prev) => prev.map((c) => (c.id === cat.id ? cat : c)));
    setEditingCat(null);
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const cat = {
      id: `cat-${generateId().slice(0, 8)}`,
      name: newCatName.trim(),
      color: newCatColor,
      icon: 'Tag',
    };
    await db.saveCategory(cat);
    setLocalCategories((prev) => [...prev, cat]);
    setNewCatName('');
    setShowAddCat(false);
  };

  const handleDeleteCategory = async (id) => {
    await db.deleteCategory(id);
    setLocalCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSavePaySettings = async () => {
    const account = accounts.find(a => a.id === editingAccountId);
    if (!account) return;

    // Derive legacy fields from cycles for backward compat
    const validCycles = localPayCycles
      .filter(c => c.frequency && c.nextPayDate)
      .map(({ amountInput, ...rest }) => rest); // strip temp input field
    const nearest = validCycles.sort((a, b) => a.nextPayDate.localeCompare(b.nextPayDate))[0];

    const updated = {
      ...account,
      name: localAccountName.trim() || account.name,
      type: localAccountType,
      payCycles: validCycles,
      payFrequency: nearest?.frequency || null,
      nextPayDate: nearest?.nextPayDate || null,
      updatedAt: Date.now(),
    };
    await db.saveAccount(updated);

    // Update global settings if this is the active account
    if (editingAccountId === activeAccount?.id) {
      if (nearest?.frequency) await db.saveSetting('payFrequency', nearest.frequency);
      if (nearest?.nextPayDate) await db.saveSetting('nextPayDate', nearest.nextPayDate);
    }

    setEditingAccountId(null);
    window.location.reload();
  };

  const startEditingAccount = (account) => {
    setEditingAccountId(account.id);
    setLocalAccountName(account.name || '');
    setLocalAccountType(account.type || 'checking');
    // Migrate: build payCycles from legacy if needed
    if (account.payCycles && account.payCycles.length > 0) {
      setLocalPayCycles([...account.payCycles]);
    } else if (account.payFrequency) {
      setLocalPayCycles([{
        id: Math.random().toString(36).slice(2, 10),
        name: '',
        frequency: account.payFrequency,
        nextPayDate: account.nextPayDate || '',
      }]);
    } else {
      setLocalPayCycles([]);
    }
  };

  const addPayCycle = () => {
    setLocalPayCycles(prev => [...prev, {
      id: Math.random().toString(36).slice(2, 10),
      name: '',
      frequency: '',
      nextPayDate: '',
    }]);
  };

  const updatePayCycle = (cycleId, field, value) => {
    setLocalPayCycles(prev => prev.map(c =>
      c.id === cycleId ? { ...c, [field]: value } : c
    ));
  };

  const removePayCycle = (cycleId) => {
    setLocalPayCycles(prev => prev.filter(c => c.id !== cycleId));
  };

  // Envelope functions
  const loadEnvelopes = () => {
    const envs = (activeAccount?.envelopes || []).map(e => ({
      ...e,
      resetType: e.resetType || 'duration',
      resetValue: e.resetValue || 'monthly',
    }));
    setLocalEnvelopes([...envs]);
    setShowEnvelopeEditor(true);
  };

  const addEnvelope = () => {
    // Default to first pay cycle if one exists, otherwise monthly duration
    const defaultCycles = activeAccount?.payCycles || [];
    const hasPayCycles = defaultCycles.length > 0;
    setLocalEnvelopes(prev => [...prev, {
      id: generateId().slice(0, 8),
      categoryId: '',
      amount: '',
      note: '',
      isActive: true,
      resetType: hasPayCycles ? 'cycle' : 'duration',  // 'cycle' or 'duration'
      resetValue: hasPayCycles ? defaultCycles[0].id : 'monthly',  // cycle id or duration value
    }]);
  };

  const updateEnvelope = (envId, field, value) => {
    setLocalEnvelopes(prev => prev.map(e =>
      e.id === envId ? { ...e, [field]: value } : e
    ));
  };

  const removeEnvelope = (envId) => {
    setLocalEnvelopes(prev => prev.filter(e => e.id !== envId));
  };

  const saveEnvelopes = async () => {
    if (!activeAccount) return;
    const cleaned = localEnvelopes
      .filter(e => e.categoryId && e.amount)
      .map(({ amountInput, ...rest }) => ({
        ...rest,
        amount: typeof rest.amount === 'string' ? parseFloat(rest.amount) || 0 : rest.amount,
        resetType: rest.resetType || 'duration',
        resetValue: rest.resetValue || 'monthly',
      }));

    const updated = { ...activeAccount, envelopes: cleaned, updatedAt: Date.now() };
    await db.saveAccount(updated);
    setShowEnvelopeEditor(false);
    window.location.reload();
  };

  // Get expense categories for envelope picker (exclude income and "other")
  const expenseCategories = categories.filter(c => !c.isIncome && c.id !== 'cat-other');

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-white px-5 py-5 overflow-x-hidden">
      <div className="flex-1">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <button 
  onClick={() => navigate('/')}
  className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
>
  <ChevronLeft size={18} />
  Home
</button>
        </div>

                {/* ── Account & Sync Section ── */}
        <div className="mb-8">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-3">Account & Sync</p>

          {!isSignedIn ? (
            /* Signed Out State */
            <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <CloudOff size={20} className="text-text-muted" />
                  <p className="text-base font-semibold">Sign in to sync</p>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">
                  Back up your data and access it across devices.<br />
                  Your data always stays on your device first.
                </p>
              </div>

              <div className="px-5 pb-5 flex flex-col gap-3">
                <button
                  onClick={handleAppleSignIn}
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  <AppleLogo className="w-5 h-5" />
                  Sign in with Apple
                </button>

                <button
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white text-text border border-border text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  <GoogleLogo className="w-5 h-5" />
                  Sign in with Google
                </button>
              </div>

              <div className="px-5 pb-5 text-center">
                <p className="text-[10px] text-text-muted">
                  We never see your password. Authentication is handled securely by Apple and Google.
                </p>
              </div>
            </div>
          ) : (
            /* Signed In State */
            <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-brand-50 flex items-center justify-center">
                    <Cloud size={18} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{userProfile?.name || userProfile?.email || 'Signed in'}</p>
                    <p className="text-xs text-text-muted">Synced {formatSyncTime(syncStatus.lastSync)}</p>
                  </div>
                </div>

                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-brand-50 text-brand-600 text-sm font-medium disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Syncing...' : 'Sync now'}
                </button>
              </div>

              <div className="border-t border-border-light px-5 py-3">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium text-text-secondary py-2"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Accounts — one card per account with inline pay settings */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-text-secondary uppercase tracking-wider">Your accounts</p>
            {canAddAccount && (
              <button onClick={() => navigate('/add-account')}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 border border-brand-200">
                <Plus size={12} /> New Account
              </button>
            )}
          </div>

          {accounts.map((account) => (
            <div key={account.id} className="bg-surface-card rounded-[10px] border border-border overflow-hidden mb-3">
              {editingAccountId === account.id ? (
                /* ── Editing mode ── */
                <div className="px-4 py-3">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs text-text-muted uppercase tracking-wider">Editing</p>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingAccountId(null)}
                        className="text-xs text-text-muted px-2 py-1">Cancel</button>
                      <button onClick={handleSavePaySettings}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-success-50 text-success-600 border border-success-500/30">
                        <Check size={12} /> Save
                      </button>
                    </div>
                  </div>

                  {/* Account name */}
                  <div className="mb-3">
                    <label className="text-[11px] text-text-muted block mb-1">Account name</label>
                    <input type="text" value={localAccountName}
                      onChange={(e) => setLocalAccountName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-brand-500 box-border" />
                  </div>

                  {/* Account type */}
                  <div className="mb-3">
                    <label className="text-[11px] text-text-muted block mb-1">Account type</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {ACCOUNT_TYPES.map((at) => (
                        <button key={at.type} onClick={() => setLocalAccountType(at.type)}
                          className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                            localAccountType === at.type
                              ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                              : 'border border-border text-text-secondary'
                          }`}>{at.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Pay cycles */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] text-text-muted block">Pay cycles</label>
                      <button onClick={addPayCycle}
                        className="text-[10px] text-brand-500 font-medium">+ Add cycle</button>
                    </div>

                    {localPayCycles.length === 0 && (
                      <p className="text-[11px] text-text-muted py-2">No pay cycles set. Tap "Add cycle" to track a payday.</p>
                    )}

                    {localPayCycles.map((cycle, idx) => (
                      <div key={cycle.id} className="bg-surface rounded-[10px] border border-border-light p-3 mb-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] text-text-muted uppercase tracking-wider">
                            Cycle {idx + 1}
                          </span>
                          <button onClick={() => removePayCycle(cycle.id)}
                            className="text-[10px] text-danger-500 font-medium">Remove</button>
                        </div>

                        {/* Cycle name (optional) */}
                        <div className="mb-2">
                          <input type="text" placeholder="Name (e.g. Jason, Sarah)"
                            value={cycle.name}
                            onChange={(e) => updatePayCycle(cycle.id, 'name', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-surface-card text-xs focus:outline-none focus:border-brand-500 box-border" />
                        </div>

                        {/* Frequency */}
                        <div className="grid grid-cols-2 gap-1 mb-2">
                          {PAY_FREQUENCIES.map((pf) => (
                            <button key={pf.value}
                              onClick={() => updatePayCycle(cycle.id, 'frequency', cycle.frequency === pf.value ? '' : pf.value)}
                              className={`py-1.5 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                                cycle.frequency === pf.value
                                  ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                                  : 'border border-border text-text-secondary'
                              }`}>{pf.label}</button>
                          ))}
                        </div>

                        {/* Next payday */}
                        {cycle.frequency && (
                          <input type="date" value={cycle.nextPayDate}
                            onChange={(e) => updatePayCycle(cycle.id, 'nextPayDate', e.target.value)}
                            onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
                            onClick={(e) => { try { e.target.showPicker(); } catch {} }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-surface-card text-xs focus:outline-none focus:border-brand-500 box-border appearance-none"
                            style={{ maxWidth: '100%' }} />
                        )}

                        {/* Pay amount (Premium) */}
                        {isPremium && cycle.frequency && (
                          <div className="mt-2">
                            <label className="text-[10px] text-text-muted block mb-0.5">Paycheck amount (optional)</label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-text-muted">$</span>
                              <input type="text" inputMode="decimal"
                                placeholder="Auto-schedule paycheck"
                                value={cycle.amountInput !== undefined ? cycle.amountInput : (cycle.amount || '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                    updatePayCycle(cycle.id, 'amountInput', val);
                                    updatePayCycle(cycle.id, 'amount', val ? parseFloat(val) || null : null);
                                  }
                                }}
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card text-xs focus:outline-none focus:border-brand-500 box-border" />
                            </div>
                            <p className="text-[9px] text-text-muted mt-0.5">Set to auto-add paycheck to scheduled items</p>
                          </div>
                        )}
                        {!isPremium && cycle.frequency && (
                          <p className="text-[9px] text-brand-500 mt-2">Premium: auto-schedule paychecks with amount</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── Display mode ── */
                <div className="px-4 py-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">
                        {account.name}
                        {account.id === activeAccount?.id && (
                          <span className="ml-2 text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full">Active</span>
                        )}
                      </p>
                      <p className="text-xs text-text-muted capitalize mt-0.5">{account.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatCurrency(account.currentBalance)}</span>
                    </div>
                  </div>

                  {/* Pay cycles info */}
                  {((account.payCycles && account.payCycles.length > 0) || account.payFrequency) && (
                    <div className="mt-2 pt-2 border-t border-border-light">
                      {account.payCycles && account.payCycles.length > 0 ? (
                        account.payCycles.map((cycle) => (
                          <div key={cycle.id} className="flex gap-3 items-center mb-1 last:mb-0 flex-wrap">
                            {cycle.name && (
                              <p className="text-[11px] text-text-secondary font-medium min-w-[50px]">{cycle.name}</p>
                            )}
                            <p className="text-[11px] text-text-muted">
                              {PAY_FREQUENCIES.find(p => p.value === cycle.frequency)?.label || cycle.frequency}
                            </p>
                            {cycle.nextPayDate && (
                              <p className="text-[11px] text-text-muted">
                                Next: <span className="text-text-secondary">{cycle.nextPayDate}</span>
                              </p>
                            )}
                            {cycle.amount && (
                              <p className="text-[11px] text-success-600 font-medium">
                                ${cycle.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="flex gap-4">
                          {account.payFrequency && (
                            <p className="text-[11px] text-text-muted">
                              Pay: <span className="text-text-secondary capitalize">{PAY_FREQUENCIES.find(p => p.value === account.payFrequency)?.label || account.payFrequency}</span>
                            </p>
                          )}
                          {account.nextPayDate && (
                            <p className="text-[11px] text-text-muted">
                              Next: <span className="text-text-secondary">{account.nextPayDate}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-2 pt-2 border-t border-border-light">
                    <button onClick={() => startEditingAccount(account)}
                      className="flex items-center gap-1 text-[11px] text-brand-500 font-medium">
                      <Pencil size={10} /> Manage
                    </button>
                    {accounts.length > 1 && account.id !== activeAccount?.id && (
                      <button onClick={() => openConfirm({
                        title: `Delete "${account.name}"?`,
                        message: 'All transactions in this account will be permanently removed.',
                        confirmWord: 'DELETE',
                        confirmLabel: 'Delete account',
                        action: () => deleteAccountById(account.id),
                      })}
                        className="flex items-center gap-1 text-[11px] text-danger-500 font-medium ml-3">
                        <Trash2 size={10} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

               {/* Budget Envelopes (Premium) */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-text-secondary uppercase tracking-wider">Budget Envelopes</p>
            {isPremium ? (
              <button onClick={loadEnvelopes}
                className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-2xl bg-brand-50 text-brand-600 border border-brand-200 hover:bg-brand-100 transition-colors">
                <Pencil size={10} /> Edit
              </button>
            ) : (
              <span className="text-[10px] text-brand-500 font-medium bg-brand-50 px-2 py-1 rounded-full">Premium</span>
            )}
          </div>

          {!isPremium ? (
            <div className="bg-white rounded-2xl border border-border-light p-5 text-center">
              <p className="text-sm text-text-secondary mb-1">Set spending limits by category</p>
              <p className="text-[11px] text-text-muted">Track groceries, dining, gas and more against your budget each pay cycle.</p>
            </div>
          ) : showEnvelopeEditor ? (
            <div className="bg-white rounded-2xl border border-border-light p-4">
              <p className="text-[11px] text-text-muted mb-3">Set a budget per category. Choose when each envelope resets.</p>

              {localEnvelopes.length === 0 && (
                <p className="text-[11px] text-text-muted text-center py-3">No envelopes yet. Tap "Add" below.</p>
              )}

              {localEnvelopes.map((env, idx) => (
                <div key={env.id} className="bg-surface rounded-[12px] border border-border-light p-3 mb-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Envelope {idx + 1}</span>
                    <button onClick={() => removeEnvelope(env.id)}
                      className="text-[10px] text-danger-500 font-medium">Remove</button>
                  </div>

                  {/* Category picker */}
                  <select
                    value={env.categoryId}
                    onChange={(e) => updateEnvelope(env.id, 'categoryId', e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-border bg-surface-card text-xs mb-2 focus:outline-none focus:border-brand-500 box-border"
                  >
                    <option value="">Select category...</option>
                    {expenseCategories.map(cat => (
                      <option key={cat.id} value={cat.id}
                        disabled={localEnvelopes.some(e => e.id !== env.id && e.categoryId === cat.id)}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                  {/* Note / description */}
                  <input type="text"
                    placeholder="Note (optional)"
                    value={env.note || ''}
                    onChange={(e) => updateEnvelope(env.id, 'note', e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-border bg-surface-card text-xs mb-2 focus:outline-none focus:border-brand-500 box-border" />

                  {/* Amount */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs text-text-muted">$</span>
                    <input type="text" inputMode="decimal"
                      placeholder="Budget per period"
                      value={env.amountInput !== undefined ? env.amountInput : (env.amount || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                          updateEnvelope(env.id, 'amountInput', val);
                          updateEnvelope(env.id, 'amount', val ? parseFloat(val) || '' : '');
                        }
                      }}
                      className="flex-1 px-2.5 py-2 rounded-lg border border-border bg-surface-card text-xs focus:outline-none focus:border-brand-500 box-border" />
                  </div>

                  {/* Reset period */}
                  <div className="mb-2">
                    <label className="text-[10px] text-text-muted block mb-1">Resets every</label>
                    <div className="flex gap-1.5 mb-1.5">
                      <button
                        onClick={() => {
                          const cycles = activeAccount?.payCycles || [];
                          updateEnvelope(env.id, 'resetType', 'cycle');
                          updateEnvelope(env.id, 'resetValue', cycles[0]?.id || '');
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                          env.resetType === 'cycle'
                            ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                            : 'border border-border text-text-secondary'
                        }`}>Pay cycle</button>
                      <button
                        onClick={() => {
                          updateEnvelope(env.id, 'resetType', 'duration');
                          updateEnvelope(env.id, 'resetValue', 'monthly');
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                          env.resetType === 'duration'
                            ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                            : 'border border-border text-text-secondary'
                        }`}>Fixed period</button>
                    </div>

                    {env.resetType === 'cycle' ? (
                      <select
                        value={env.resetValue || ''}
                        onChange={(e) => updateEnvelope(env.id, 'resetValue', e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg border border-border bg-surface-card text-xs focus:outline-none focus:border-brand-500 box-border"
                      >
                        <option value="">Select pay cycle...</option>
                        {(activeAccount?.payCycles || []).map((cycle, idx) => {
                          const freqLabel = PAY_FREQUENCIES.find(p => p.value === cycle.frequency)?.label || cycle.frequency;
                          const displayName = cycle.name
                            ? `${cycle.name} (${freqLabel})`
                            : `Cycle ${idx + 1} — ${freqLabel}`;
                          return (
                            <option key={cycle.id} value={cycle.id}>
                              {displayName}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <div>
                        <div className="flex gap-1 mb-1.5">
                          {RESET_DURATIONS.map(d => (
                            <button key={d.value}
                              onClick={() => updateEnvelope(env.id, 'resetValue', d.value)}
                              className={`flex-1 py-1.5 px-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                                env.resetValue === d.value
                                  ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                                  : 'border border-border text-text-secondary'
                              }`}>{d.label}</button>
                          ))}
                        </div>
                        <label className="text-[9px] text-text-muted block mb-0.5">Next reset date</label>
                        <input type="date"
                          value={env.resetDate || ''}
                          onChange={(e) => updateEnvelope(env.id, 'resetDate', e.target.value)}
                          onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
                          onClick={(e) => { try { e.target.showPicker(); } catch {} }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-surface-card text-xs focus:outline-none focus:border-brand-500 box-border appearance-none"
                          style={{ maxWidth: '100%' }} />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex gap-2 mt-3">
                <button onClick={addEnvelope}
                  className="flex-1 py-2 rounded-[10px] border border-brand-200 text-xs font-medium text-brand-600 bg-brand-50">
                  + Add envelope
                </button>
                <button onClick={saveEnvelopes}
                  className="flex-1 py-2 rounded-[10px] bg-brand-500 text-white text-xs font-medium">
                  Save
                </button>
              </div>
              <button onClick={() => setShowEnvelopeEditor(false)}
                className="w-full mt-2 py-1.5 text-[11px] text-text-muted text-center">Cancel</button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border-light p-4">
              {(activeAccount?.envelopes || []).filter(e => e.isActive).length === 0 ? (
                <p className="text-[11px] text-text-muted text-center py-2">No envelopes set up. Tap Edit to create your first budget.</p>
              ) : (
                <div className="space-y-2">
                  {(activeAccount?.envelopes || []).filter(e => e.isActive).map(env => {
                    const cat = categories.find(c => c.id === env.categoryId);
                    const resetLabel = env.resetType === 'cycle'
                      ? (() => {
                          const cycle = (activeAccount?.payCycles || []).find(c => c.id === env.resetValue);
                          return cycle?.name || PAY_FREQUENCIES.find(p => p.value === cycle?.frequency)?.label || '';
                        })()
                      : RESET_DURATIONS.find(d => d.value === env.resetValue)?.label || '';
                    return (
                      <div key={env.id} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat?.color || '#6B7280' }} />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium">{cat?.name || 'Unknown'}</span>
                          {env.note && <span className="text-[10px] text-text-muted ml-1">({env.note})</span>}
                          {resetLabel && <span className="text-[9px] text-text-muted ml-1">· {resetLabel}</span>}
                        </div>
                        <span className="text-xs text-text-secondary font-semibold shrink-0">{formatCurrency(env.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

               {/* Categories */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-text-secondary uppercase tracking-wider">Categories</p>
            <button
              onClick={() => setShowAddCat(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-2xl bg-brand-50 text-brand-600 border border-brand-200 hover:bg-brand-100 transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {/* Expense categories */}
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 px-1">Expenses</p>
          <div className="bg-white rounded-3xl border border-border shadow-sm divide-y divide-border-light overflow-hidden mb-4">
            {localCategories.filter(c => !c.isIncome && c.id !== 'cat-other').map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 px-5 py-3">
                <div 
                  className="w-5 h-5 rounded-2xl shrink-0 shadow-sm"
                  style={{ backgroundColor: cat.color }}
                />
                {editingCat === cat.id ? (
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <input 
                      type="text" 
                      defaultValue={cat.name} 
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCategory({ ...cat, name: e.target.value }); }}
                      className="flex-1 min-w-0 text-sm px-3 py-2 rounded-2xl border border-border focus:outline-none focus:border-brand-500 box-border"
                    />
                    <button onClick={() => setEditingCat(null)} className="text-text-muted p-2 shrink-0"><X size={18} /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm truncate">{cat.name}</span>
                    <button onClick={() => setEditingCat(cat.id)} className="text-text-muted p-2 shrink-0"><Pencil size={16} /></button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-text-muted p-2 shrink-0"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Income categories */}
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 px-1">Income</p>
          <div className="bg-white rounded-3xl border border-border shadow-sm divide-y divide-border-light overflow-hidden mb-4">
            {localCategories.filter(c => c.isIncome).sort((a, b) => {
              if (a.id === 'cat-paycheck') return -1;
              if (b.id === 'cat-paycheck') return 1;
              return 0;
            }).map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 px-5 py-3">
                <div 
                  className="w-5 h-5 rounded-2xl shrink-0 shadow-sm"
                  style={{ backgroundColor: cat.color }}
                />
                {editingCat === cat.id ? (
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <input 
                      type="text" 
                      defaultValue={cat.name} 
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCategory({ ...cat, name: e.target.value }); }}
                      className="flex-1 min-w-0 text-sm px-3 py-2 rounded-2xl border border-border focus:outline-none focus:border-brand-500 box-border"
                    />
                    <button onClick={() => setEditingCat(null)} className="text-text-muted p-2 shrink-0"><X size={18} /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm truncate">{cat.name}</span>
                    <button onClick={() => setEditingCat(cat.id)} className="text-text-muted p-2 shrink-0"><Pencil size={16} /></button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-text-muted p-2 shrink-0"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Other category */}
          <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
            {localCategories.filter(c => c.id === 'cat-other').map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 px-5 py-3">
                <div 
                  className="w-5 h-5 rounded-2xl shrink-0 shadow-sm"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="flex-1 text-sm truncate text-text-muted">{cat.name}</span>
              </div>
            ))}
          </div>

          {/* Add category inline */}
          {showAddCat && (
            <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden mt-4">
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Category name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    autoFocus
                    className="flex-1 min-w-0 text-sm px-4 py-3 rounded-2xl border border-border focus:outline-none focus:border-brand-500 box-border"
                  />
                  <button
                    onClick={handleAddCategory}
                    disabled={!newCatName.trim()}
                    className="p-3 rounded-2xl bg-brand-500 text-white disabled:opacity-40 shrink-0"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => { setShowAddCat(false); setNewCatName(''); }}
                    className="p-3 text-text-muted shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewCatColor(color)}
                      className="w-7 h-7 rounded-2xl transition-transform"
                      style={{
                        backgroundColor: color,
                        transform: newCatColor === color ? 'scale(1.25)' : 'scale(1)',
                        border: newCatColor === color ? '2px solid white' : 'none',
                        boxShadow: newCatColor === color ? `0 0 0 2px ${color}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export data */}
        <div className="mb-6">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Data</p>
          <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden">
            <button onClick={handleExportCSV}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-surface/50">
              <Download size={18} className="text-brand-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Export to CSV</p>
                <p className="text-xs text-text-muted mt-0.5">Download all transactions as a spreadsheet</p>
              </div>
            </button>
          </div>
        </div>

        {/* Premium upsell */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-brand-50 to-success-50 rounded-3xl border border-brand-100 p-5 shadow-sm">
            <p className="text-base font-semibold text-brand-700 mb-1">TilPaid Premium</p>
            <p className="text-sm text-brand-600 leading-relaxed mb-4">
              Recurring bills & deposits, look-ahead view, savings targets, spending trend alerts, 
              joint account access, custom warning thresholds, and more.
            </p>
            <button className="w-full py-3.5 rounded-2xl bg-brand-500 text-white text-sm font-medium active:scale-[0.98] transition-transform">
              Coming soon
            </button>
          </div>
        </div>

        {/* Clear & Start Fresh */}
        <div className="mb-6">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Account reset</p>
          <div className="bg-surface-card rounded-[10px] border border-border p-4">
            <div className="flex items-start gap-3 mb-3">
              <RotateCcw size={18} className="text-text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Clear & start fresh</p>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Clears all transactions and resets your balance. Your categories and settings
                  are kept. Great if you've been away and want a clean start.
                </p>
              </div>
            </div>
            {!showReset ? (
              <button
                onClick={() => setShowReset(true)}
                className="w-full py-2.5 rounded-[10px] border border-danger-500/30 text-danger-500 text-sm font-medium"
              >
                Reset account
              </button>
            ) : (
              <div>
                <div className="mb-3">
                  <label className="text-xs text-text-secondary block mb-1.5">New starting balance</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Enter your current balance"
                    value={resetBalance}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                        setResetBalance(val);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!resetBalance) return;
                      await resetAccount({ newBalance: resetBalance });
                      setShowReset(false);
                      setResetBalance('');
                    }}
                    disabled={!resetBalance}
                    className="flex-1 py-2.5 rounded-[10px] bg-danger-500 text-white text-sm font-medium disabled:opacity-40"
                  >
                    Confirm reset
                  </button>
                  <button
                    onClick={() => { setShowReset(false); setResetBalance(''); }}
                    className="flex-1 py-2.5 rounded-[10px] border border-border text-sm font-medium text-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* App info */}
        <div className="text-center text-xs text-text-muted py-6">
          <p>TilPaid v0.1.0</p>
          <p className="mt-1">Your data stays on this device</p>
          <div className="flex justify-center gap-3 mt-2">
            <button onClick={() => navigate('/privacy')} className="text-brand-500 font-medium">Privacy Policy</button>
            <span>·</span>
            <button onClick={() => navigate('/terms')} className="text-brand-500 font-medium">Terms of Service</button>
          </div>
        </div>
      </div>

      <BottomNav />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={handleConfirmAction}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmWord={confirmModal.confirmWord}
        confirmLabel={confirmModal.confirmLabel}
      />
    </div>
  );
}
