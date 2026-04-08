import { useState, useMemo } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, isBefore } from 'date-fns';
import { formatCurrency } from '../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarView({ upcomingItems, currentBalance, categories, accounts, onItemTap }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const getCat = (catId) => categories.find(c => c.id === catId);

  const itemsByDate = useMemo(() => {
    const map = {};
    upcomingItems.forEach(item => {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    });
    return map;
  }, [upcomingItems]);

  const dailyBalances = useMemo(() => {
    const balances = {};
    let bal = currentBalance;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    balances[todayStr] = currentBalance;

    const allDates = [...new Set(upcomingItems.map(i => i.date))].sort();
    for (const dateStr of allDates) {
      const items = itemsByDate[dateStr] || [];
      const dayTotal = items.reduce((sum, item) => sum + item.amount, 0);
      bal = Math.round((bal + dayTotal) * 100) / 100;
      balances[dateStr] = bal;
    }
    return balances;
  }, [upcomingItems, currentBalance, itemsByDate]);

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

  const getProjectedBalance = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dailyBalances[dateStr] !== undefined ? dailyBalances[dateStr] : currentBalance;
  };

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedItems = selectedDateStr ? (itemsByDate[selectedDateStr] || []) : [];
  const selectedBalance = selectedDate ? getProjectedBalance(selectedDate) : null;

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 text-text-secondary active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <p className="text-base font-semibold">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 text-text-secondary active:scale-95">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-xs text-text-muted font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid - soft floating style */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dayItems = itemsByDate[dateStr] || [];
          const hasExpense = dayItems.some(i => i.type === 'expense');
          const hasIncome = dayItems.some(i => i.type === 'income');
          const projBal = !isBefore(day, new Date()) && (isCurrentDay || dayItems.length > 0) 
            ? getProjectedBalance(day) 
            : null;

          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(isSameDay(day, selectedDate) ? null : day)}
              className={`relative flex flex-col items-center py-2 min-h-[62px] rounded-3xl transition-all shadow-sm ${
                !inMonth ? 'opacity-30' :
                isSelected ? 'bg-brand-50 shadow-md' :
                isCurrentDay ? 'bg-brand-500/10' :
                dayItems.length > 0 ? 'bg-white shadow-sm' : 'bg-white'
              }`}
            >
              <span className={`text-sm font-medium ${
                isSelected ? 'text-brand-600' :
                isCurrentDay ? 'text-brand-500' : 'text-text'
              }`}>
                {format(day, 'd')}
              </span>

              {dayItems.length > 0 && inMonth && (
                <div className="flex gap-0.5 mt-1">
                  {hasExpense && <div className="w-1.5 h-1.5 rounded-full bg-danger-400" />}
                  {hasIncome && <div className="w-1.5 h-1.5 rounded-full bg-success-400" />}
                </div>
              )}

              {projBal !== null && inMonth && (
                <span className={`text-[10px] leading-tight mt-1 font-medium ${
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

      {/* Selected date detail - soft & clean (no heavy borders) */}
      {selectedDate && (
        <div className="mt-6 pt-5">
          <div className="bg-white rounded-3xl shadow-sm p-5">
            <div className="flex justify-between items-baseline mb-4">
              <p className="text-base font-semibold">
                {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE, MMMM d')}
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
              <p className="text-sm text-text-muted py-8 text-center">No bills or deposits on this day</p>
            ) : (
              selectedItems.map(item => {
                const cat = getCat(item.categoryId);
                const isIncome = item.type === 'income';

                return (
                  <div 
                    key={item.id}
                    onClick={() => onItemTap?.(item.recurringId)}
                    className="flex items-center gap-3 py-3 px-4 bg-white rounded-3xl shadow-sm mb-2 cursor-pointer hover:shadow transition-all"
                  >
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-medium shrink-0" 
                         style={{ backgroundColor: `${cat?.color || '#6B7280'}15`, color: cat?.color || '#6B7280' }}>
                      {item.description?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.description}</p>
                      <p className="text-xs text-text-muted">{cat?.name || 'Uncategorized'}</p>
                    </div>
                    <p className={`text-sm font-medium ${isIncome ? 'text-success-500' : ''}`}>
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}