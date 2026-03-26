import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { generateId, formatCurrency } from '../lib/utils';
import * as db from '../lib/db';
import BottomNav from '../components/BottomNav';
import { Plus, Pencil, Trash2, X, Check, RotateCcw, Download } from 'lucide-react';
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

const ACCOUNT_TYPES = [
  { type: 'checking', label: 'Checking' },
  { type: 'savings', label: 'Savings' },
  { type: 'money-market', label: 'Money Market' },
];

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
  const [localPayFreq, setLocalPayFreq] = useState('');
  const [localNextPay, setLocalNextPay] = useState('');
  const [localAccountType, setLocalAccountType] = useState('');
  const [localAccountName, setLocalAccountName] = useState('');

  // Reset state
  const [showReset, setShowReset] = useState(false);
  const [resetBalance, setResetBalance] = useState('');

  // Confirm modal states
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, title: '', message: '', confirmWord: null, confirmLabel: '' });

  const openConfirm = (opts) => setConfirmModal({ isOpen: true, ...opts });
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false, action: null }));
  const handleConfirmAction = async () => {
    if (confirmModal.action) await confirmModal.action();
    closeConfirm();
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

    const updated = {
      ...account,
      name: localAccountName.trim() || account.name,
      type: localAccountType,
      payFrequency: localPayFreq || null,
      nextPayDate: localNextPay || null,
      updatedAt: Date.now(),
    };
    await db.saveAccount(updated);

    // Update global settings if this is the active account
    if (editingAccountId === activeAccount?.id) {
      if (localPayFreq) await db.saveSetting('payFrequency', localPayFreq);
      if (localNextPay) await db.saveSetting('nextPayDate', localNextPay);
    }

    setEditingAccountId(null);
    window.location.reload();
  };

  const startEditingAccount = (account) => {
    setEditingAccountId(account.id);
    setLocalAccountName(account.name || '');
    setLocalAccountType(account.type || 'checking');
    setLocalPayFreq(account.payFrequency || '');
    setLocalNextPay(account.nextPayDate || '');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col overflow-x-hidden">
      <div className="flex-1 px-5 py-5 pb-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <button onClick={() => navigate('/')}
            className="text-sm text-brand-500 font-medium">
            Done
          </button>
        </div>

        {/* Accounts — one card per account with inline pay settings */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-text-secondary uppercase tracking-wider">Your accounts</p>
            {canAddAccount && (
              <button onClick={() => navigate('/add-account')}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 border border-brand-200">
                <Plus size={12} /> Add
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

                  {/* Pay frequency */}
                  <div className="mb-3">
                    <label className="text-[11px] text-text-muted block mb-1">Pay frequency</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PAY_FREQUENCIES.map((pf) => (
                        <button key={pf.value}
                          onClick={() => setLocalPayFreq(localPayFreq === pf.value ? '' : pf.value)}
                          className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                            localPayFreq === pf.value
                              ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                              : 'border border-border text-text-secondary'
                          }`}>{pf.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Next payday */}
                  {localPayFreq && (
                    <div>
                      <label className="text-[11px] text-text-muted block mb-1">Next payday</label>
                      <input type="date" value={localNextPay}
                        onChange={(e) => setLocalNextPay(e.target.value)}
                        onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
                        onClick={(e) => { try { e.target.showPicker(); } catch {} }}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-brand-500 box-border appearance-none"
                        style={{ maxWidth: '100%' }} />
                    </div>
                  )}
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

                  {/* Pay info */}
                  {(account.payFrequency || account.nextPayDate) && (
                    <div className="flex gap-4 mt-2 pt-2 border-t border-border-light">
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

                  {/* Actions */}
                  <div className="flex gap-2 mt-2 pt-2 border-t border-border-light">
                    <button onClick={() => startEditingAccount(account)}
                      className="flex items-center gap-1 text-[11px] text-brand-500 font-medium">
                      <Pencil size={10} /> Edit
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

        {/* Categories */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-text-secondary uppercase tracking-wider">Categories</p>
            <button
              onClick={() => setShowAddCat(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 border border-brand-200"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {/* Expense categories */}
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1 px-1">Expenses</p>
          <div className="bg-surface-card rounded-[10px] border border-border divide-y divide-border-light overflow-hidden mb-3">
            {localCategories.filter(c => !c.isIncome && c.id !== 'cat-other').map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                {editingCat === cat.id ? (
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <input type="text" defaultValue={cat.name} autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCategory({ ...cat, name: e.target.value }); }}
                      className="flex-1 min-w-0 text-sm px-2 py-1 rounded border border-border focus:outline-none focus:border-brand-500 box-border" />
                    <button onClick={() => setEditingCat(null)} className="text-text-muted p-1 shrink-0"><X size={16} /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm truncate">{cat.name}</span>
                    <button onClick={() => setEditingCat(cat.id)} className="text-text-muted p-1 shrink-0"><Pencil size={14} /></button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-text-muted p-1 shrink-0"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Income categories */}
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1 px-1">Income</p>
          <div className="bg-surface-card rounded-[10px] border border-border divide-y divide-border-light overflow-hidden mb-3">
            {localCategories.filter(c => c.isIncome).sort((a, b) => {
              if (a.id === 'cat-paycheck') return -1;
              if (b.id === 'cat-paycheck') return 1;
              return 0;
            }).map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                {editingCat === cat.id ? (
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <input type="text" defaultValue={cat.name} autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCategory({ ...cat, name: e.target.value }); }}
                      className="flex-1 min-w-0 text-sm px-2 py-1 rounded border border-border focus:outline-none focus:border-brand-500 box-border" />
                    <button onClick={() => setEditingCat(null)} className="text-text-muted p-1 shrink-0"><X size={16} /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm truncate">{cat.name}</span>
                    <button onClick={() => setEditingCat(cat.id)} className="text-text-muted p-1 shrink-0"><Pencil size={14} /></button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-text-muted p-1 shrink-0"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Other category */}
          <div className="bg-surface-card rounded-[10px] border border-border divide-y divide-border-light overflow-hidden">
            {localCategories.filter(c => c.id === 'cat-other').map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="flex-1 text-sm truncate text-text-muted">{cat.name}</span>
              </div>
            ))}
          </div>

          {/* Add category inline */}
          {showAddCat && (
            <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden mt-2 mb-3">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Category name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    autoFocus
                    className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-brand-500 box-border"
                  />
                  <button
                    onClick={handleAddCategory}
                    disabled={!newCatName.trim()}
                    className="p-2 rounded-lg bg-brand-500 text-white disabled:opacity-40 shrink-0"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => { setShowAddCat(false); setNewCatName(''); }}
                    className="p-2 text-text-muted shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewCatColor(color)}
                      className="w-6 h-6 rounded-full transition-transform"
                      style={{
                        backgroundColor: color,
                        transform: newCatColor === color ? 'scale(1.3)' : 'scale(1)',
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
        <div className="mb-6">
          <div className="bg-gradient-to-br from-brand-50 to-success-50 rounded-[14px] border border-brand-100 p-4">
            <p className="text-sm font-semibold text-brand-700 mb-1">TilPaid Premium</p>
            <p className="text-xs text-brand-600 leading-relaxed mb-3">
              Recurring bills & deposits, look-ahead view, savings targets, spending trend
              alerts, joint account access, custom warning thresholds, and more.
            </p>
            <button className="w-full py-2.5 rounded-[10px] bg-brand-500 text-white text-sm font-medium">
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

        {/* Dev tools — remove before production */}
        <div className="mb-6">
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Developer tools</p>
          <div className="bg-surface-card rounded-[10px] border border-border divide-y divide-border-light overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Premium mode</p>
                <p className="text-xs text-text-muted">Toggle to test premium features</p>
              </div>
              <button
                onClick={async () => {
                  const newVal = !isPremium;
                  await db.saveSetting('isPremium', newVal);
                  window.location.reload();
                }}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  isPremium ? 'bg-success-500' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                  isPremium ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            <button
              onClick={() => openConfirm({
                title: 'Erase all data?',
                message: 'This will permanently delete ALL accounts, transactions, recurring items, categories, and settings. The app will restart as if it were freshly installed.',
                confirmWord: 'ERASE',
                confirmLabel: 'Erase everything',
                action: async () => {
                  await db.clearAllData();
                  window.location.reload();
                },
              })}
              className="w-full px-4 py-3 text-left text-sm text-danger-500 font-medium"
            >
              Clear all data & restart
            </button>
          </div>
          <p className="text-[10px] text-text-muted mt-1.5 text-center">Remove this section before App Store release</p>
        </div>

        {/* App info */}
        <div className="text-center text-xs text-text-muted py-4">
          <p>TilPaid v0.1.0</p>
          <p className="mt-1">Your data stays on this device</p>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={handleConfirmAction}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmWord={confirmModal.confirmWord}
        confirmLabel={confirmModal.confirmLabel}
      />

      <BottomNav />
    </div>
  );
}
