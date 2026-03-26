import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { todayISO } from '../lib/utils';
import * as db from '../lib/db';
import { ChevronLeft, Trash2 } from 'lucide-react';
import AmountInput from '../components/AmountInput';

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semi-monthly', label: '1st & 15th' },
  { value: 'monthly', label: 'Monthly' },
];

export default function EditRecurringScreen() {
  const { categories, accounts, activeAccountId } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();

  const [recurring, setRecurring] = useState(null);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('0.00');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [isAutoDraft, setIsAutoDraft] = useState(true);
  const [isApproximate, setIsApproximate] = useState(false);
  const [reminderDays, setReminderDays] = useState('2');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const r = await db.getRecurringTransaction(id);
      if (!r) { navigate('/upcoming'); return; }

      setRecurring(r);
      setType(r.type || 'expense');
      setAmount(Math.abs(r.amount).toFixed(2));
      setDescription(r.description || '');
      setCategoryId(r.categoryId || '');
      setFrequency(r.frequency || 'monthly');
      setStartDate(r.startDate || todayISO());
      setDayOfMonth(r.dayOfMonth || '');
      setIsAutoDraft(r.isAutoDraft ?? true);
      setIsApproximate(r.isApproximate ?? false);
      setReminderDays(String(r.reminderDays || 2));
      setSelectedAccountId(r.accountId || activeAccountId);
      setIsLoading(false);
    }
    load();
  }, [id, navigate, activeAccountId]);

  const filteredCats = categories.filter((c) => {
    if (type === 'income') return c.isIncome || c.id === 'cat-other';
    return !c.isIncome;
  }).sort((a, b) => {
    if (a.id === 'cat-paycheck') return -1;
    if (b.id === 'cat-paycheck') return 1;
    return 0;
  });

  const handleSave = async () => {
    setError('');
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum === 0) { setError('Please enter an amount'); return; }
    if (!description.trim()) { setError('Please enter a description'); return; }
    if (!categoryId) { setError('Please select a category'); return; }

    const updated = {
      ...recurring,
      accountId: selectedAccountId,
      description: description.trim(),
      amount: type === 'expense' ? -Math.abs(amountNum) : Math.abs(amountNum),
      categoryId,
      type,
      frequency,
      startDate,
      dayOfMonth: frequency === 'semi-monthly' ? (dayOfMonth || '1,15') : null,
      isAutoDraft,
      isApproximate,
      reminderDays: parseInt(reminderDays) || 2,
      updatedAt: Date.now(),
    };

    await db.saveRecurringTransaction(updated);
    navigate('/upcoming');
  };

  const handleDelete = async () => {
    if (confirm(`Delete recurring "${description}"? This cannot be undone.`)) {
      await db.deleteRecurringTransaction(id);
      navigate('/upcoming');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-5 py-5 overflow-x-hidden">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate('/upcoming')} className="flex items-center gap-1 text-brand-500 text-sm font-medium">
          <ChevronLeft size={18} /> Back
        </button>
        <p className="text-base font-semibold">Edit recurring</p>
        <button onClick={handleDelete} className="p-2 text-danger-500">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Amount */}
      <div className="mb-5">
        <AmountInput value={amount} onChange={setAmount} type={type} autoFocus={false} />
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={() => { setType('expense'); if (categoryId === 'cat-income') setCategoryId(''); }}
            className={`px-7 py-2.5 rounded-full text-sm font-medium transition-colors ${
              type === 'expense' ? 'bg-danger-500 text-white' : 'border border-border text-text-secondary'
            }`}
          >Bill</button>
          <button
            onClick={() => { setType('income'); setCategoryId(''); }}
            className={`px-7 py-2.5 rounded-full text-sm font-medium transition-colors ${
              type === 'income' ? 'bg-success-500 text-white' : 'border border-border text-text-secondary'
            }`}
          >Deposit</button>
        </div>
      </div>

      {/* Description */}
      <div className="mb-5">
        <label className="text-xs text-text-secondary block mb-1.5">Description</label>
        <input type="text" value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border"
        />
      </div>

      {/* Account selector */}
      {accounts.length > 1 && (
        <div className="mb-5">
          <label className="text-xs text-text-secondary block mb-1.5">Account</label>
          <div className="flex flex-wrap gap-2">
            {accounts.map((acc) => (
              <button key={acc.id} onClick={() => setSelectedAccountId(acc.id)}
                className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-colors ${
                  selectedAccountId === acc.id
                    ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                    : 'border border-border text-text-secondary'
                }`}
              >{acc.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Category */}
      <div className="mb-5">
        <label className="text-xs text-text-secondary block mb-1.5">Category</label>
        <div className="flex flex-wrap gap-2">
          {filteredCats.map((cat) => (
            <button key={cat.id} onClick={() => setCategoryId(cat.id)}
              className="px-4 py-2 rounded-full text-[13px] font-medium transition-all"
              style={{
                backgroundColor: categoryId === cat.id ? `${cat.color}20` : 'transparent',
                color: cat.color,
                border: categoryId === cat.id ? `1.5px solid ${cat.color}` : `1px solid ${cat.color}30`,
              }}
            >{cat.name}</button>
          ))}
        </div>
      </div>

      {/* Frequency */}
      <div className="mb-5">
        <label className="text-xs text-text-secondary block mb-1.5">Frequency</label>
        <div className="grid grid-cols-2 gap-2">
          {FREQUENCIES.map((f) => (
            <button key={f.value} onClick={() => setFrequency(f.value)}
              className={`py-2.5 px-3 rounded-[10px] text-[13px] font-medium transition-colors ${
                frequency === f.value
                  ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                  : 'border border-border text-text-secondary'
              }`}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* Start date */}
      <div className="mb-5">
        <label className="text-xs text-text-secondary block mb-1.5">Next due date</label>
        <input type="date" value={startDate}
          onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
          onClick={(e) => { try { e.target.showPicker(); } catch {} }}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border appearance-none"
          style={{ maxWidth: '100%' }}
        />
      </div>

      {frequency === 'semi-monthly' && (
        <div className="mb-5">
          <label className="text-xs text-text-secondary block mb-1.5">Days of month</label>
          <input type="text" placeholder="1,15" value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border"
          />
        </div>
      )}

      {/* Toggles */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-4 py-3 bg-surface-card rounded-t-[10px] border border-border border-b-0">
          <div>
            <p className="text-sm font-medium">{type === 'income' ? 'Direct deposit' : 'Auto-draft'}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {type === 'income' ? 'Automatically deposited' : 'Automatically deducted'}
            </p>
          </div>
          <button onClick={() => setIsAutoDraft(!isAutoDraft)}
            className={`w-12 h-7 rounded-full transition-colors relative ${isAutoDraft ? 'bg-success-500' : 'bg-gray-300'}`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${isAutoDraft ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-surface-card rounded-b-[10px] border border-border">
          <div>
            <p className="text-sm font-medium">Approximate amount</p>
            <p className="text-xs text-text-muted mt-0.5">Amount varies each cycle</p>
          </div>
          <button onClick={() => setIsApproximate(!isApproximate)}
            className={`w-12 h-7 rounded-full transition-colors relative ${isApproximate ? 'bg-warning-500' : 'bg-gray-300'}`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${isApproximate ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {!isAutoDraft && (
        <div className="mb-5">
          <label className="text-xs text-text-secondary block mb-1.5">Remind me (days before)</label>
          <div className="flex gap-2">
            {['1', '2', '3', '5', '7'].map((d) => (
              <button key={d} onClick={() => setReminderDays(d)}
                className={`flex-1 py-2.5 rounded-[10px] text-sm font-medium transition-colors ${
                  reminderDays === d ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700' : 'border border-border text-text-secondary'
                }`}>{d}d</button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 px-3 py-2 bg-danger-50 rounded-lg">
          <p className="text-xs text-danger-700">{error}</p>
        </div>
      )}

      <button onClick={handleSave} disabled={!amount || parseFloat(amount) === 0}
        className="w-full py-3.5 rounded-[10px] bg-brand-500 text-white text-[15px] font-medium disabled:opacity-40 active:scale-[0.98] transition-transform">
        Save changes
      </button>
    </div>
  );
}
