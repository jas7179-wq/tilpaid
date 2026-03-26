import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as db from '../lib/db';
import { formatCurrency } from '../lib/utils';

export default function DescriptionInput({
  value,
  onChange,
  onSuggestSelect,
  type = 'expense',
  placeholder,
}) {
  const { activeAccountId } = useApp();
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allDescriptions, setAllDescriptions] = useState([]);
  const inputRef = useRef(null);

  // Load all unique descriptions on mount
  useEffect(() => {
    async function load() {
      if (!activeAccountId) return;
      const descs = await db.getUniqueDescriptions(activeAccountId);
      setAllDescriptions(descs);
    }
    load();
  }, [activeAccountId]);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    onChange(val);

    if (val.length >= 1) {
      const filtered = allDescriptions.filter((d) =>
        d.description.toLowerCase().startsWith(val.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [onChange, allDescriptions]);

  const handleSelect = useCallback((suggestion) => {
    onChange(suggestion.description);
    setShowSuggestions(false);
    if (onSuggestSelect) {
      onSuggestSelect({
        categoryId: suggestion.lastCategoryId,
        amount: suggestion.lastAmount,
        type: suggestion.lastType,
      });
    }
  }, [onChange, onSuggestSelect]);

  const handleFocus = useCallback(() => {
    if (value.length >= 1) {
      const filtered = allDescriptions.filter((d) =>
        d.description.toLowerCase().startsWith(value.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    }
  }, [value, allDescriptions]);

  return (
    <div className="relative">
      <label className="text-xs text-text-secondary block mb-1.5">Description</label>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder || (type === 'income' ? 'e.g. Paycheck, Freelance, Refund...' : 'e.g. H-E-B, Shell, Netflix...')}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="w-full px-4 py-3 rounded-[10px] border border-border bg-surface-card text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 box-border"
      />

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-surface-card border border-border rounded-[10px] shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className="w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-surface transition-colors border-b border-border-light last:border-b-0"
            >
              <div>
                <p className="text-sm font-medium">{s.description}</p>
                <p className="text-xs text-text-muted">
                  used {s.count} time{s.count !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-secondary">
                  last {formatCurrency(s.lastAmount)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
