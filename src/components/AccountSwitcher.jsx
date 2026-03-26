import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';
import { ChevronDown, Plus, Lock } from 'lucide-react';

export default function AccountSwitcher() {
  const { accounts, activeAccount, switchAccount, canAddAccount } = useApp();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when tapping outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  if (!activeAccount) return null;

  // Single account — just show label, no dropdown
  if (accounts.length <= 1 && !canAddAccount) {
    return (
      <p className="text-xs text-text-secondary uppercase tracking-wider">
        {activeAccount.name}
      </p>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-text-secondary uppercase tracking-wider active:opacity-70"
      >
        {activeAccount.name}
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-surface-card border border-border rounded-[12px] shadow-lg z-30 overflow-hidden">
          {/* Account list */}
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                switchAccount(account.id);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left flex items-center justify-between border-b border-border-light last:border-b-0 transition-colors ${
                account.id === activeAccount.id ? 'bg-brand-50' : 'hover:bg-surface'
              }`}
            >
              <div>
                <p className={`text-sm font-medium ${
                  account.id === activeAccount.id ? 'text-brand-700' : 'text-text'
                }`}>
                  {account.name}
                </p>
                <p className="text-xs text-text-muted capitalize">{account.type}</p>
              </div>
              <p className={`text-sm font-medium ${
                account.id === activeAccount.id ? 'text-brand-600' : 'text-text-secondary'
              }`}>
                {formatCurrency(account.currentBalance)}
              </p>
            </button>
          ))}

          {/* Add account */}
          <button
            onClick={() => {
              setIsOpen(false);
              if (canAddAccount) {
                navigate('/add-account');
              }
            }}
            className="w-full px-4 py-3 text-left flex items-center gap-2 border-t border-border hover:bg-surface transition-colors"
          >
            {canAddAccount ? (
              <>
                <Plus size={16} className="text-brand-500" />
                <span className="text-sm font-medium text-brand-500">Add account</span>
              </>
            ) : (
              <>
                <Lock size={14} className="text-text-muted" />
                <span className="text-sm text-text-muted">More accounts with Premium</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
