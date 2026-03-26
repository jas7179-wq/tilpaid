import { formatCurrency, formatDate } from '../lib/utils';
import { Flag } from 'lucide-react';

export default function StartingBalanceLine({ account }) {
  if (!account) return null;

  const date = new Date(account.createdAt);
  const dateStr = date.toISOString().split('T')[0];

  return (
    <div className="flex items-center gap-3 py-3 px-1 opacity-50">
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-brand-50 border-[1.5px] dashed border-brand-200">
        <Flag size={14} className="text-brand-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium italic text-text-secondary">Starting Balance</p>
        <p className="text-xs text-text-muted mt-0.5">
          Account opened · {formatDate(dateStr)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium text-brand-600">
          {formatCurrency(account.startingBalance)}
        </p>
      </div>
    </div>
  );
}
