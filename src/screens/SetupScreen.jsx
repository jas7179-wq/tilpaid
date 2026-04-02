import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { todayISO } from '../lib/utils';
import { addDays, addWeeks, format } from 'date-fns';

const ACCOUNT_TYPES = [
  { type: 'checking', label: 'Checking' },
  { type: 'savings', label: 'Savings' },
  { type: 'money-market', label: 'Money Market' },
];

const PAY_FREQUENCIES = [
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semi-monthly', label: '1st & 15th' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
];

export default function SetupScreen() {
  const { completeSetup } = useApp();
  const [step, setStep] = useState(0);
  const [accountType, setAccountType] = useState('checking');
  const [balance, setBalance] = useState('');
  const [payFrequency, setPayFrequency] = useState('biweekly');
  const [nextPayDate, setNextPayDate] = useState('');

  const handleComplete = async () => {
    const label = ACCOUNT_TYPES.find((t) => t.type === accountType)?.label || 'Checking';
    await completeSetup({
      accountName: label,
      accountType,
      balance: balance || '0',
      payFrequency,
      nextPayDate: nextPayDate || null,
    });
  };

  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
        <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-brand-600 to-success-500 flex items-center justify-center mb-4">
          <span className="text-white text-3xl font-medium">T</span>
        </div>
        <h1 className="text-3xl font-semibold mb-2">TilPaid</h1>
        <p className="text-text-secondary text-[15px] mb-10">Know what's left til payday</p>

        <div className="w-full max-w-sm space-y-3">
          <button className="w-full py-3.5 rounded-[10px] bg-black text-white text-[15px] font-medium flex items-center justify-center gap-2">
             Sign in with Apple
          </button>
          <button className="w-full py-3.5 rounded-[10px] bg-surface-card text-text border border-border text-[15px] font-medium flex items-center justify-center gap-2">
            G Sign in with Google
          </button>
          <button
            onClick={() => setStep(1)}
            className="w-full py-3 text-brand-500 text-sm font-medium"
          >
            Skip for now — start local
          </button>
        </div>

        <p className="text-xs text-text-muted mt-8 text-center max-w-xs leading-relaxed">
          Your data stays on your device. Sign in later to unlock sync and premium features.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <h1 className="text-2xl font-semibold mb-1">Let's get you set up</h1>
      <p className="text-sm text-text-secondary mb-8">This takes about 30 seconds</p>

      {/* Account type */}
      <div className="mb-7">
        <label className="text-xs text-text-secondary uppercase tracking-wider block mb-2">
          Select your account
        </label>
        <div className="space-y-2">
          {ACCOUNT_TYPES.map((at) => (
            <label
              key={at.type}
              className={`flex items-center gap-3 p-3.5 rounded-[10px] cursor-pointer transition-colors ${
                accountType === at.type
                  ? 'bg-brand-50 border-[1.5px] border-brand-500'
                  : 'bg-surface-card border border-border'
              }`}
            >
              <input
                type="radio"
                name="accountType"
                value={at.type}
                checked={accountType === at.type}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">{at.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Balance */}
      <div className="mb-7">
        <label className="text-xs text-text-secondary uppercase tracking-wider block mb-2">
          Current balance
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0.00"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-lg focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border"
        />
        <p className="text-xs text-text-muted mt-1.5">Check your bank app for the exact amount</p>
      </div>

      {/* Pay frequency */}
      <div className="mb-7">
        <label className="text-xs text-text-secondary uppercase tracking-wider block mb-2">
          When do you get paid?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PAY_FREQUENCIES.map((pf) => (
            <button
              key={pf.value}
              onClick={() => setPayFrequency(pf.value)}
              className={`py-2.5 px-3 rounded-[10px] text-[13px] font-medium transition-colors ${
                payFrequency === pf.value
                  ? 'bg-brand-50 border-[1.5px] border-brand-500 text-brand-700'
                  : 'border border-border text-text-secondary'
              }`}
            >
              {pf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Next pay date */}
      <div className="mb-8">
        <label className="text-xs text-text-secondary uppercase tracking-wider block mb-2">
          Next payday
        </label>
        <input
          type="date"
          value={nextPayDate}
          onChange={(e) => setNextPayDate(e.target.value)}
          className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border appearance-none"
          style={{ maxWidth: '100%', WebkitAppearance: 'none' }}
        />
      </div>

      <button
        onClick={handleComplete}
        disabled={!balance}
        className="w-full py-3.5 rounded-[10px] bg-brand-500 text-white text-[15px] font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
      >
        Start tracking
      </button>
    </div>
  );
}
