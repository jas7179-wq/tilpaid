import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { todayISO } from '../lib/utils';
import { ChevronLeft } from 'lucide-react';
import AmountInput from '../components/AmountInput';
import DescriptionInput from '../components/DescriptionInput';

export default function AddTransactionScreen() {
  const { categories, addTransaction, lastAdjustment, isPremium, nextPayDate, activeAccount } = useApp();
  const navigate = useNavigate();

  // Effective max date: account payday > global payday > 30 days out
  const effectiveMaxDate = (() => {
    if (isPremium) return null;
    const payDate = activeAccount?.nextPayDate || nextPayDate;
    if (payDate) return payDate;
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 30);
    return fallback.toISOString().split('T')[0];
  })();

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('0.00');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');

  const filteredCats = categories.filter((c) => {
    if (type === 'income') return c.isIncome || c.id === 'cat-other';
    return !c.isIncome;
  }).sort((a, b) => {
    // Paycheck always first in income list
    if (a.id === 'cat-paycheck') return -1;
    if (b.id === 'cat-paycheck') return 1;
    return 0;
  });

  const minDate = lastAdjustment ? lastAdjustment.date : null;

  const handleSuggestSelect = useCallback(({ categoryId: catId, amount: lastAmt, type: lastType }) => {
    if (catId) setCategoryId(catId);
  }, []);

  const handleSave = async () => {
    setError('');
    const amountNum = parseFloat(amount);

    if (!amountNum || amountNum === 0) {
      setError('Please enter an amount');
      return;
    }

    const today = todayISO();
    const selectedDate = date || today;
    if (!isPremium && effectiveMaxDate && selectedDate > effectiveMaxDate) {
      setError('Free accounts can only date transactions within the current pay cycle.');
      return;
    }

    if (minDate && selectedDate < minDate) {
      setError('Cannot enter transactions before your last balance adjustment');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    await addTransaction({
      amount: amountNum,
      description: description || (type === 'income' ? 'Income' : 'Expense'),
      categoryId,
      date: selectedDate,
      type,
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface px-5 py-5 overflow-x-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-brand-500 text-sm font-medium">
          <ChevronLeft size={18} /> Back
        </button>
        <p className="text-base font-semibold">New transaction</p>
        <div className="w-14" />
      </div>

      {/* Amount - ATM style */}
      <div className="mb-6">
        <AmountInput
          value={amount}
          onChange={setAmount}
          type={type}
          autoFocus={true}
        />

        {/* Type toggle */}
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={() => { setType('expense'); setCategoryId(''); }}
            className={`px-7 py-2.5 rounded-full text-sm font-medium transition-colors ${
              type === 'expense'
                ? 'bg-danger-500 text-white'
                : 'border border-border text-text-secondary'
            }`}
          >
            Expense
          </button>
          <button
            onClick={() => { setType('income'); setCategoryId(''); }}
            className={`px-7 py-2.5 rounded-full text-sm font-medium transition-colors ${
              type === 'income'
                ? 'bg-success-500 text-white'
                : 'border border-border text-text-secondary'
            }`}
          >
            Income
          </button>
        </div>
      </div>

      {/* Description with auto-suggest */}
      <div className="mb-5">
        <DescriptionInput
          value={description}
          onChange={setDescription}
          onSuggestSelect={handleSuggestSelect}
          type={type}
        />
      </div>

      {/* Category */}
      <div className="mb-5">
        <label className="text-xs text-text-secondary block mb-1.5">
          Category {!categoryId && <span className="text-text-muted">— tap to select</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          {filteredCats.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryId(cat.id)}
              className="px-4 py-2 rounded-full text-[13px] font-medium transition-all"
              style={{
                backgroundColor: categoryId === cat.id ? `${cat.color}20` : 'transparent',
                color: cat.color,
                border: categoryId === cat.id ? `1.5px solid ${cat.color}` : `1px solid ${cat.color}30`,
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="mb-6">
        <label className="text-xs text-text-secondary block mb-1.5">Date</label>
        <div className="relative">
          <input
            type="date"
            value={date}
            min={minDate || undefined}
            max={effectiveMaxDate || undefined}
            onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
            onClick={(e) => { try { e.target.showPicker(); } catch {} }}
            onChange={(e) => {
              const val = e.target.value;
              if (!isPremium && effectiveMaxDate && val > effectiveMaxDate) {
                setDate(effectiveMaxDate);
                setError('Free accounts can only date within the current pay cycle.');
              } else if (minDate && val < minDate) {
                setDate(minDate);
                setError('Cannot enter transactions before your last balance adjustment');
              } else {
                setDate(val);
                setError('');
              }
            }}
            className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border appearance-none"
            style={{ maxWidth: '100%' }}
          />
        </div>
        {!isPremium && effectiveMaxDate && (
          <p className="text-[11px] text-text-muted mt-1.5">
            Dates limited to current pay cycle ({effectiveMaxDate}). <span className="text-brand-500 font-medium">Premium</span> unlocks unlimited.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-danger-50 rounded-lg">
          <p className="text-xs text-danger-700">{error}</p>
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!amount || parseFloat(amount) === 0}
        className="w-full py-3.5 rounded-[10px] bg-brand-500 text-white text-[15px] font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
      >
        Save transaction
      </button>
    </div>
  );
}
