import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { todayISO } from '../lib/utils';
import { ChevronLeft, Trash2, Lock } from 'lucide-react';
import AmountInput from '../components/AmountInput';
import DescriptionInput from '../components/DescriptionInput';
import * as db from '../lib/db';

export default function EditTransactionScreen() {
  const { categories, activeAccountId, deleteTransactionById, refreshTransactions, lastAdjustment, isPremium, nextPayDate, activeAccount } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();

  // Effective max date for scheduled transactions
  const effectiveMaxDate = (() => {
    if (isPremium) return null;
    const payDate = activeAccount?.nextPayDate || nextPayDate;
    if (payDate) return payDate;
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 30);
    return fallback.toISOString().split('T')[0];
  })();

  const [transaction, setTransaction] = useState(null);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('0.00');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState('');
  const [originalDate, setOriginalDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    async function load() {
      const tx = await db.getTransaction(id);
      if (!tx) {
        navigate('/');
        return;
      }

      if (lastAdjustment && !tx.isAdjustment) {
        const txTime = new Date(tx.date).getTime() + (tx.createdAt || 0);
        const adjTime = new Date(lastAdjustment.date).getTime() + (lastAdjustment.createdAt || 0);
        if (txTime < adjTime) {
          setIsLocked(true);
        }
      }
      if (tx.isAdjustment) {
        setIsLocked(true);
      }

      setTransaction(tx);
      setType(tx.type || (tx.amount >= 0 ? 'income' : 'expense'));
      setAmount(Math.abs(tx.amount).toFixed(2));
      setDescription(tx.description || '');
      setCategoryId(tx.categoryId || '');
      setDate(tx.date || todayISO());
      setOriginalDate(tx.date || todayISO());
      setIsLoading(false);
    }
    load();
  }, [id, navigate, lastAdjustment]);

  const filteredCats = categories.filter((c) => {
    if (type === 'income') return c.isIncome || c.id === 'cat-other';
    return !c.isIncome;
  }).sort((a, b) => {
    if (a.id === 'cat-paycheck') return -1;
    if (b.id === 'cat-paycheck') return 1;
    return 0;
  });

  const handleSuggestSelect = useCallback(({ categoryId: catId }) => {
    if (catId) setCategoryId(catId);
  }, []);

  const handleSave = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum === 0 || !transaction) return;

    const updated = {
      ...transaction,
      amount: type === 'expense' ? -Math.abs(amountNum) : Math.abs(amountNum),
      description: description || (type === 'income' ? 'Income' : 'Expense'),
      categoryId,
      date,
      type,
      updatedAt: Date.now(),
    };

    await db.saveTransaction(updated);
    await refreshTransactions();
    navigate('/');
  };

  const handleDelete = async () => {
    await deleteTransactionById(id);
    navigate('/');
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
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-brand-500 text-sm font-medium">
          <ChevronLeft size={18} /> Back
        </button>
        <p className="text-base font-semibold">{isLocked ? 'View transaction' : 'Edit transaction'}</p>
        {!isLocked ? (
          <button onClick={handleDelete} className="p-2 text-danger-500">
            <Trash2 size={18} />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {isLocked && (
        <div className="bg-warning-50 rounded-[10px] px-3.5 py-2.5 mb-5 flex items-center gap-2.5">
          <Lock size={16} className="text-warning-500 shrink-0" />
          <p className="text-xs text-warning-700">
            This transaction is locked because it was recorded before your last balance adjustment.
          </p>
        </div>
      )}

      {/* Amount - ATM style */}
      <div className="mb-6">
        <AmountInput
          value={amount}
          onChange={setAmount}
          type={type}
          autoFocus={!isLocked}
        />

        {/* Type toggle */}
        {!transaction?.isAdjustment && !isLocked && (
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={() => { setType('expense'); if (categoryId === 'cat-income') setCategoryId(''); }}
              className={`px-7 py-2.5 rounded-full text-sm font-medium transition-colors ${
                type === 'expense'
                  ? 'bg-danger-500 text-white'
                  : 'border border-border text-text-secondary'
              }`}
            >
              Expense
            </button>
            <button
              onClick={() => { setType('income'); setCategoryId('cat-income'); }}
              className={`px-7 py-2.5 rounded-full text-sm font-medium transition-colors ${
                type === 'income'
                  ? 'bg-success-500 text-white'
                  : 'border border-border text-text-secondary'
              }`}
            >
              Income
            </button>
          </div>
        )}
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
      {!transaction?.isAdjustment && (
        <div className="mb-5">
          <label className="text-xs text-text-secondary block mb-1.5">Category</label>
          <div className="flex flex-wrap gap-2">
            {filteredCats.map((cat) => (
              <button
                key={cat.id}
                onClick={() => !isLocked && setCategoryId(cat.id)}
                className="px-4 py-2 rounded-full text-[13px] font-medium transition-all"
                style={{
                  backgroundColor: categoryId === cat.id ? `${cat.color}20` : 'transparent',
                  color: cat.color,
                  border: categoryId === cat.id ? `1.5px solid ${cat.color}` : `1px solid ${cat.color}30`,
                  opacity: isLocked ? 0.5 : 1,
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date */}
      <div className="mb-8">
        <label className="text-xs text-text-secondary block mb-1.5">Date</label>
        {(() => {
          const wasPosted = originalDate <= todayISO();
          const maxDate = wasPosted ? todayISO() : (effectiveMaxDate || undefined);
          return (
            <input
              type="date"
              value={date}
              max={maxDate}
              disabled={isLocked}
              onFocus={(e) => { if (!isLocked) try { e.target.showPicker(); } catch {} }}
              onClick={(e) => { if (!isLocked) try { e.target.showPicker(); } catch {} }}
              onChange={(e) => {
                const val = e.target.value;
                if (wasPosted && val > todayISO()) {
                  setDate(todayISO());
                } else if (!isPremium && effectiveMaxDate && val > effectiveMaxDate) {
                  setDate(effectiveMaxDate);
                } else {
                  setDate(val);
                }
              }}
              className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border appearance-none disabled:opacity-50"
              style={{ maxWidth: '100%' }}
            />
          );
        })()}
        {originalDate <= todayISO() ? (
          <p className="text-[10px] text-text-muted mt-1">Posted transactions can't be moved to future dates</p>
        ) : !isPremium && effectiveMaxDate && (
          <p className="text-[10px] text-text-muted mt-1">Limited to current pay cycle ({effectiveMaxDate})</p>
        )}
      </div>

      {/* Save */}
      {!isLocked && (
        <button
          onClick={handleSave}
          disabled={!amount || parseFloat(amount) === 0}
          className="w-full py-3.5 rounded-[10px] bg-brand-500 text-white text-[15px] font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          Save changes
        </button>
      )}
    </div>
  );
}
