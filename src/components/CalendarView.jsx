import { useState, useMemo } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, isBefore, parseISO } from 'date-fns';
import { formatCurrency } from '../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarView({ upcomingItems, currentBalance, categories, accounts, onItemTap }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const getCat = (catId) => categories.find(c => c.id === catId);
  const getAccountName = (accId) => accounts.find(a => a.id === accId)?.name || '';

  // Build a map of date -> items
  const itemsByDate = useMemo(() => {
    const map = {};
    upcomingItems.forEach(item => {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    });
    return map;
  }, [upcomingItems]);

  // Calculate projected balance for each day
  const dailyBalances = useMemo(() => {
    const balances = {};
    let runningBalance = currentBalance;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all dates with items, sorted
    const allDates = [...new Set(upcomingItems.map(i => i.date))].sort();

    // Also include today
    const todayStr = format(today, 'yyyy-MM-dd');
    balances[todayStr] = currentBalance;

    let bal = currentBalance;
    for (const dateStr of allDates) {
      const items = itemsByDate[dateStr] || [];
      const dayTotal = items.reduce((sum, item) => sum + item.amount, 0);
      bal = Math.round((bal + dayTotal) * 100) / 100;
      balances[dateStr] = bal;
    }

    return balances;
  }, [upcomingItems, currentBalance, itemsByDate]);

  // Generate calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const weeks = [];
  let day = calStart;
  while (day <= calEnd) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(day));
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  // Get the most recent projected balance on or before a given date
  const getProjectedBalance = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (dailyBalances[dateStr] !== undefined) return dailyBalances[dateStr];

    // Find the closest prior date with a balance
    const sortedDates = Object.keys(dailyBalances).sort();
    let lastBal = currentBalance;
    for (const d of sortedDates) {
      if (d > dateStr) break;
      lastBal = dailyBalances[d];
    }
    return lastBal;
  };

  // Items for selected date
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedItems = selectedDateStr ? (itemsByDate[selectedDateStr] || []) : [];
  const selectedBalance = selectedDate ? getProjectedBalance(selectedDate) : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 text-text-secondary active:scale-95">
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-semibold">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 text-text-secondary active:scale-95">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[10px] text-text-muted font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {weeks.flat().map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dayItems = itemsByDate[dateStr] || [];
          const hasExpense = dayItems.some(i => i.type === 'expense');
          const hasIncome = dayItems.some(i => i.type === 'income');
          const isPast = isBefore(day, today) && !isCurrentDay;
          const projBal = !isPast && (isCurrentDay || dayItems.length > 0) ? getProjectedBalance(day) : null;

          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(isSameDay(day, selectedDate) ? null : day)}
              className={`relative flex flex-col items-center py-1.5 min-h-[52px] rounded-lg transition-colors ${
                !inMonth ? 'opacity-30' :
                isSelected ? 'bg-brand-50 border border-brand-200' :
                isCurrentDay ? 'bg-brand-500/10' :
                ''
              }`}
            >
              <span className={`text-[11px] font-medium leading-none ${
                isSelected ? 'text-brand-600' :
                isCurrentDay ? 'text-brand-500 font-bold' :
                isPast ? 'text-text-muted' :
                'text-text'
              }`}>
                {format(day, 'd')}
              </span>

              {/* Dots for bills/deposits */}
              {(hasExpense || hasIncome) && inMonth && (
                <div className="flex gap-0.5 mt-0.5">
                  {hasExpense && <div className="w-1 h-1 rounded-full bg-danger-400" />}
                  {hasIncome && <div className="w-1 h-1 rounded-full bg-success-400" />}
                </div>
              )}

              {/* Projected balance (small) */}
              {projBal !== null && inMonth && !isPast && (
                <span className={`text-[8px] leading-tight mt-0.5 font-medium ${
                  projBal < 0 ? 'text-danger-500' : projBal <= 250 ? 'text-warning-500' : 'text-text-muted'
                }`}>
                  {projBal < 0 ? '-' : ''}{Math.abs(projBal) >= 1000
                    ? `$${(Math.abs(projBal) / 1000).toFixed(1)}k`
                    : `$${Math.abs(projBal).toFixed(0)}`
                  }
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold">
              {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEE, MMM d')}
            </p>
            {selectedBalance !== null && (
              <p className={`text-sm font-medium ${
                selectedBalance < 0 ? 'text-danger-500' : selectedBalance <= 250 ? 'text-warning-500' : 'text-text-secondary'
              }`}>
                Projected: {formatCurrency(selectedBalance)}
              </p>
            )}
          </div>

          {selectedItems.length === 0 ? (
            <p className="text-xs text-text-muted py-3">No bills or deposits on this day</p>
          ) : (
            selectedItems.map(item => {
              const cat = getCat(item.categoryId);
              const color = cat?.color || '#6B7280';
              const isIncome = item.type === 'income';
              const accName = accounts.length > 1 ? getAccountName(item.accountId) : '';

              return (
                <div key={item.id}
                  onClick={() => onItemTap?.(item.recurringId)}
                  className="flex items-center gap-3 py-2.5 border-b border-border-light cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0"
                    style={{ backgroundColor: `${color}12`, color, border: `1px dashed ${color}40` }}>
                    {item.description?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{item.description}</p>
                    <p className="text-[11px] text-text-muted">
                      {cat?.name || 'Uncategorized'}
                      {accName && ` · ${accName}`}
                      {item.isApproximate && ' · Est.'}
                    </p>
                  </div>
                  <p className={`text-[13px] font-medium shrink-0 ${isIncome ? 'text-success-500' : ''}`}>
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
