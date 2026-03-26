import { Timer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { daysUntil } from '../lib/utils';

export default function PaydayBanner() {
  const { nextPayDate } = useApp();

  if (!nextPayDate) return null;

  const days = daysUntil(nextPayDate);
  if (days < 0) return null;

  return (
    <div className="bg-brand-50 rounded-[10px] px-3.5 py-2.5 flex items-center gap-2.5 mb-5">
      <Timer size={20} className="text-brand-600 shrink-0" />
      <div>
        <p className="text-[13px] font-medium text-brand-700">
          {days === 0 ? 'Payday!' : `${days} day${days !== 1 ? 's' : ''} til payday`}
        </p>
      </div>
    </div>
  );
}
