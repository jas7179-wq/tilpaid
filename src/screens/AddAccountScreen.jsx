import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ChevronLeft } from 'lucide-react';

const ACCOUNT_TYPES = [
  { type: 'checking', label: 'Checking' },
  { type: 'savings', label: 'Savings' },
  { type: 'money-market', label: 'Money Market' },
];

const PAY_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semi-monthly', label: '1st & 15th' },
  { value: 'monthly', label: 'Monthly' },
];

export default function AddAccountScreen() {
  const { addNewAccount, canAddAccount } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('checking');
  const [balance, setBalance] = useState('');
  const [payFrequency, setPayFrequency] = useState('');
  const [nextPayDate, setNextPayDate] = useState('');
  const [error, setError] = useState('');

  const selectedLabel = ACCOUNT_TYPES.find(t => t.type === accountType)?.label || '';
  const showPaySettings = accountType === 'checking';

  const handleSave = async () => {
    setError('');

    if (!balance) {
      setError('Please enter a starting balance');
      return;
    }

    if (!canAddAccount) {
      setError('Upgrade to Premium to add more accounts');
      return;
    }

    const result = await addNewAccount({
      name: name.trim() || selectedLabel,
      type: accountType,
      balance,
      payFrequency: showPaySettings ? payFrequency : null,
      nextPayDate: showPaySettings ? nextPayDate : null,
    });

    if (result?.error) {
      setError(result.error);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-surface px-5 py-5 overflow-x-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-7">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-brand-500 text-sm font-medium">
          <ChevronLeft size={18} /> Back
        </button>
        <p className="text-base font-semibold">New account</p>
        <div className="w-14" />
      </div>

      {/* Account type */}
      <div className="mb-6">
        <label className="text-xs text-text-secondary uppercase tracking-wider block mb-2">
          Account type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {ACCOUNT_TYPES.map((at) => (
            <button
              key={at.type}
              onClick={() => {
                setAccountType(at.type);
                if (!name.trim()) setName('');
              }}
              className={`py-3 px-2 rounded-[10px] text-sm font-medium transition-colors ${
                accountType === at.type
                  ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                  : 'border border-border text-text-secondary'
              }`}
            >
              {at.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom name */}
      <div className="mb-6">
        <label className="text-xs text-text-secondary uppercase tracking-wider block mb-2">
          Account name
        </label>
        <input
          type="text"
          placeholder={selectedLabel}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border"
        />
        <p className="text-[11px] text-text-muted mt-1.5">
          Optional — defaults to the account type
        </p>
      </div>

      {/* Balance */}
      <div className="mb-6">
        <label className="text-xs text-text-secondary uppercase tracking-wider block mb-2">
          Current balance
        </label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={balance}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
              setBalance(val);
            }
          }}
          className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-lg focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border"
        />
        <p className="text-[11px] text-text-muted mt-1.5">
          Check your bank app for the exact amount
        </p>
      </div>

      {/* Pay cycle — only for checking accounts */}
      {showPaySettings && (
        <div className="mb-8">
          <label className="text-xs text-text-secondary uppercase tracking-wider block mb-2">
            Pay cycle (optional)
          </label>

          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {PAY_FREQUENCIES.map((pf) => (
              <button
                key={pf.value}
                onClick={() => setPayFrequency(payFrequency === pf.value ? '' : pf.value)}
                className={`py-2.5 px-2 rounded-[10px] text-xs font-medium transition-colors ${
                  payFrequency === pf.value
                    ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                    : 'border border-border text-text-secondary'
                }`}
              >
                {pf.label}
              </button>
            ))}
          </div>

          {payFrequency && (
            <div>
              <label className="text-xs text-text-secondary block mb-1.5">Next payday</label>
              <input
                type="date"
                value={nextPayDate}
                onChange={(e) => setNextPayDate(e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
                onClick={(e) => { try { e.target.showPicker(); } catch {} }}
                className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border appearance-none"
                style={{ maxWidth: '100%' }}
              />
            </div>
          )}

          <p className="text-[10px] text-text-muted mt-1.5">
            Set up your pay cycle to see days til payday on this account
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-danger-50 rounded-lg">
          <p className="text-xs text-danger-700">{error}</p>
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!balance}
        className="w-full py-3.5 rounded-[10px] bg-brand-500 text-white text-[15px] font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
      >
        Create account
      </button>
    </div>
  );
}
