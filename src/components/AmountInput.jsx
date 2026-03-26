import { useState, useCallback } from 'react';

// ATM-style amount entry: digits build from right, decimal is automatic
// Type "4750" → displays "$47.50"
// Type "500" → displays "$5.00"
export default function AmountInput({ value, onChange, type = 'expense', autoFocus = false }) {
  // Value is stored as cents (integer) internally
  const [cents, setCents] = useState(() => {
    if (value && parseFloat(value) > 0) {
      return Math.round(parseFloat(value) * 100);
    }
    return 0;
  });

  const displayAmount = (c) => {
    if (c === 0) return '0.00';
    const dollars = Math.floor(c / 100);
    const remainder = c % 100;
    return `${dollars.toLocaleString('en-US')}.${String(remainder).padStart(2, '0')}`;
  };

  const handleKeyDown = useCallback((e) => {
    e.preventDefault();

    let newCents = cents;

    if (e.key >= '0' && e.key <= '9') {
      // Prevent absurdly large numbers (max $999,999.99)
      if (cents > 99999999) return;
      newCents = cents * 10 + parseInt(e.key);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      newCents = Math.floor(cents / 10);
    }

    setCents(newCents);
    onChange((newCents / 100).toFixed(2));
  }, [cents, onChange]);

  // For mobile: use a hidden input to trigger the numpad
  const handleInput = useCallback((e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const newCents = parseInt(raw) || 0;
    if (newCents > 99999999) return;
    setCents(newCents);
    onChange((newCents / 100).toFixed(2));
  }, [onChange]);

  const isExpense = type === 'expense';

  return (
    <div className="text-center">
      <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Amount</p>
      <div
        className="flex items-center justify-center gap-0.5 relative cursor-text"
        onClick={() => document.getElementById('amount-input-hidden')?.focus()}
      >
        <span className={`text-3xl font-medium ${isExpense ? 'text-danger-500' : 'text-success-500'}`}>
          {isExpense ? '-' : '+'}$
        </span>
        <span className="text-[40px] font-semibold tracking-tight">
          {displayAmount(cents)}
        </span>
        <span className="animate-pulse text-[40px] font-light text-brand-500 ml-0.5">|</span>

        {/* Hidden input to trigger mobile numpad */}
        <input
          id="amount-input-hidden"
          type="tel"
          inputMode="numeric"
          value={cents || ''}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          className="absolute inset-0 opacity-0 w-full h-full"
          style={{ fontSize: '40px' }}
        />
      </div>
    </div>
  );
}
