import { format, formatDistanceToNow, isToday, isYesterday, parseISO, addDays, addWeeks, addMonths, startOfDay, endOfDay, isBefore, isAfter, isSameDay } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export function generateId() {
  return uuidv4();
}

export function formatCurrency(amount) {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : ''}$${formatted}`;
}

export function formatCurrencyShort(amount) {
  const abs = Math.abs(amount);
  if (abs >= 1000) {
    return `${amount < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  }
  return formatCurrency(amount);
}

export function formatDate(dateStr) {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

export function formatDateFull(dateStr) {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return format(date, 'MMMM d, yyyy');
}

export function formatDateRelative(dateStr) {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function daysUntil(dateStr) {
  const target = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
  const now = new Date();
  const targetClean = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const nowClean = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = targetClean.getTime() - nowClean.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function computeRunningBalances(transactions, startingBalance) {
  // Sort all transactions chronologically
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt
  );

  // Find the most recent adjustment (anchor point)
  let anchorIndex = -1;
  let anchorBalance = startingBalance;

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].isAdjustment) {
      anchorIndex = i;
      break;
    }
  }

  // If there's an anchor, compute its balance by walking forward from start
  if (anchorIndex >= 0) {
    let bal = startingBalance;
    for (let i = 0; i <= anchorIndex; i++) {
      bal += sorted[i].amount;
    }
    anchorBalance = Math.round(bal * 100) / 100;
  }

  // Now build the display list with running balances
  let balance = startingBalance;
  const withBalances = sorted.map((tx, i) => {
    balance += tx.amount;
    const isPreAnchor = anchorIndex >= 0 && i < anchorIndex;
    return {
      ...tx,
      runningBalance: Math.round(balance * 100) / 100,
      isPreAnchor,
      isLocked: isPreAnchor,
    };
  });

  return withBalances.reverse();
}

// Compute current balance using anchor point model:
// Find last adjustment, use it as anchor, only add transactions after it
export function computeCurrentBalance(transactions, startingBalance) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt
  );

  // Find last adjustment
  let anchorIndex = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].isAdjustment) {
      anchorIndex = i;
      break;
    }
  }

  if (anchorIndex === -1) {
    // No adjustments — simple sum from starting balance
    const total = sorted.reduce((sum, t) => sum + t.amount, 0);
    return Math.round((startingBalance + total) * 100) / 100;
  }

  // Walk to anchor to get anchor balance
  let anchorBalance = startingBalance;
  for (let i = 0; i <= anchorIndex; i++) {
    anchorBalance += sorted[i].amount;
  }
  anchorBalance = Math.round(anchorBalance * 100) / 100;

  // Only add transactions AFTER the anchor
  let current = anchorBalance;
  for (let i = anchorIndex + 1; i < sorted.length; i++) {
    current += sorted[i].amount;
  }

  return Math.round(current * 100) / 100;
}

export function createTransaction({
  accountId,
  amount,
  description,
  categoryId,
  date,
  type = 'expense',
  isAdjustment = false,
  note = '',
}) {
  return {
    id: generateId(),
    accountId,
    amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
    description,
    categoryId,
    date: date || todayISO(),
    type,
    isAdjustment,
    note,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createAccount({ name, type, balance, payFrequency, nextPayDate }) {
  // Build payCycles array from legacy single pay settings
  const payCycles = [];
  if (payFrequency && nextPayDate) {
    payCycles.push({
      id: generateId().slice(0, 8),
      name: '',
      frequency: payFrequency,
      nextPayDate,
      amount: null, // Premium: auto-generate scheduled paycheck
    });
  }

  return {
    id: generateId(),
    name,
    type,
    startingBalance: balance,
    currentBalance: balance,
    payFrequency: payFrequency || null, // keep for backward compat
    nextPayDate: nextPayDate || null,   // keep for backward compat
    payCycles,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastReconciledAt: null,
  };
}

// Advance a single pay cycle date past today
export function advancePayCycleDate(nextPayDate, frequency) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let payDateObj = new Date(nextPayDate + 'T00:00:00');
  let advanced = false;

  while (payDateObj < today) {
    advanced = true;
    switch (frequency) {
      case 'weekly':
        payDateObj.setDate(payDateObj.getDate() + 7);
        break;
      case 'biweekly':
        payDateObj.setDate(payDateObj.getDate() + 14);
        break;
      case 'semi-monthly': {
        const d = payDateObj.getDate();
        if (d < 15) {
          payDateObj.setDate(15);
        } else {
          payDateObj.setMonth(payDateObj.getMonth() + 1);
          payDateObj.setDate(1);
        }
        break;
      }
      case 'monthly':
        payDateObj.setMonth(payDateObj.getMonth() + 1);
        break;
      default:
        payDateObj.setDate(payDateObj.getDate() + 14);
    }
  }

  return {
    date: payDateObj.toISOString().split('T')[0],
    advanced,
  };
}

// Get the nearest next pay date from an account's pay cycles
// Returns { date, cycleName } or null
export function getNextPayInfo(account) {
  const cycles = account.payCycles || [];

  // If no payCycles, fall back to legacy single fields
  if (cycles.length === 0) {
    if (account.nextPayDate) {
      return { date: account.nextPayDate, cycleName: '' };
    }
    return null;
  }

  // Find the earliest date
  let nearestDate = null;
  for (const cycle of cycles) {
    if (!cycle.nextPayDate) continue;
    if (!nearestDate || cycle.nextPayDate < nearestDate) {
      nearestDate = cycle.nextPayDate;
    }
  }

  if (!nearestDate) return null;

  // Collect all names that share the nearest date (within 3 days)
  const names = cycles
    .filter(c => c.nextPayDate && c.name)
    .filter(c => {
      const diff = Math.abs((new Date(c.nextPayDate) - new Date(nearestDate)) / (1000 * 60 * 60 * 24));
      return diff <= 3;
    })
    .map(c => c.name);

  const cycleName = names.length > 1 ? names.join(' / ') : (names[0] || '');

  return { date: nearestDate, cycleName };
}

// Generate scheduled paycheck items from pay cycles (Premium feature)
// Returns array of scheduled items that look like recurring auto items
export function generatePayCycleScheduledItems(account) {
  const cycles = account.payCycles || [];
  const items = [];
  const today = todayISO();

  for (const cycle of cycles) {
    // Only generate if premium amount is set
    if (!cycle.amount || !cycle.nextPayDate || !cycle.frequency) continue;

    // Only show if the next pay date is in the future
    if (cycle.nextPayDate <= today) continue;

    items.push({
      id: `paycycle-${cycle.id}`,
      recurringId: `paycycle-${cycle.id}`,
      accountId: account.id,
      description: cycle.name ? `${cycle.name} Paycheck` : 'Paycheck',
      amount: cycle.amount,
      type: 'income',
      date: cycle.nextPayDate,
      categoryId: 'cat-paycheck',
      isRecurringAuto: true,
      isPayCycleGenerated: true,
      payCycleId: cycle.id,
    });
  }

  return items;
}

export function createReconciliation({ accountId, balance, matched }) {
  return {
    id: generateId(),
    accountId,
    balance,
    matched,
    date: todayISO(),
    createdAt: Date.now(),
  };
}

// ── Recurring Transactions ──

export function createRecurringTransaction({
  accountId,
  description,
  amount,
  categoryId,
  type = 'expense',
  frequency = 'monthly',
  startDate,
  dayOfMonth,
  isAutoDraft = false,
  isApproximate = false,
  reminderDays = 2,
}) {
  return {
    id: generateId(),
    accountId,
    description,
    amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
    categoryId,
    type,
    frequency,
    startDate: startDate || todayISO(),
    dayOfMonth: dayOfMonth || null,
    isAutoDraft,
    isApproximate,
    reminderDays,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function getNextOccurrence(recurring, afterDate) {
  // afterDate is exclusive — find the first occurrence AFTER afterDate
  // But when called with yesterday's date, today is included
  const after = afterDate ? startOfDay(parseISO(afterDate)) : startOfDay(new Date());
  const start = startOfDay(parseISO(recurring.startDate));
  let next;

  switch (recurring.frequency) {
    case 'weekly':
      next = new Date(start);
      while (isBefore(next, after)) {
        next = addWeeks(next, 1);
      }
      break;

    case 'biweekly':
      next = new Date(start);
      while (isBefore(next, after)) {
        next = addWeeks(next, 2);
      }
      break;

    case 'monthly':
      next = new Date(start);
      while (isBefore(next, after)) {
        next = addMonths(next, 1);
      }
      break;

    case 'semi-monthly': {
      const days = recurring.dayOfMonth ? recurring.dayOfMonth.split(',').map(Number) : [1, 15];
      const year = after.getFullYear();
      const month = after.getMonth();

      const candidates = [];
      for (let m = month - 1; m <= month + 2; m++) {
        for (const d of days) {
          const candidate = new Date(year, m, d);
          if (!isBefore(candidate, after)) {
            candidates.push(candidate);
          }
        }
      }
      candidates.sort((a, b) => a - b);
      next = candidates[0] || addMonths(after, 1);
      break;
    }

    default:
      next = addMonths(new Date(start), 1);
  }

  return format(next, 'yyyy-MM-dd');
}

export function generateUpcomingOccurrences(recurring, lookAheadDays = 35) {
  if (!recurring.isActive) return [];

  const today = startOfDay(new Date());
  const endDate = addDays(today, lookAheadDays);
  const occurrences = [];

  // Start from today so we include items due today
  let searchFrom = todayISO();

  for (let i = 0; i < 20; i++) {
    const nextDate = getNextOccurrence(recurring, searchFrom);
    const nextParsed = parseISO(nextDate);

    if (isAfter(nextParsed, endDate)) break;

    const days = daysUntil(nextDate);

    occurrences.push({
      id: `upcoming-${recurring.id}-${nextDate}`,
      recurringId: recurring.id,
      accountId: recurring.accountId,
      description: recurring.description,
      amount: recurring.amount,
      categoryId: recurring.categoryId,
      type: recurring.type,
      date: nextDate,
      daysOut: days,
      isAutoDraft: recurring.isAutoDraft,
      isApproximate: recurring.isApproximate,
      isUpcoming: true,
      frequency: recurring.frequency,
    });

    // Advance past this date so next iteration finds the following occurrence
    const dayAfter = addDays(nextParsed, 1);
    searchFrom = format(dayAfter, 'yyyy-MM-dd');
  }

  return occurrences;
}

// ── Envelope / Budget Helpers ──

// Get the start date of the current pay cycle (last payday)
export function getCurrentCycleStart(account) {
  const cycles = account.payCycles || [];
  if (cycles.length === 0 && account.payFrequency && account.nextPayDate) {
    cycles.push({ frequency: account.payFrequency, nextPayDate: account.nextPayDate });
  }
  if (cycles.length === 0) return null;

  // Use the nearest next pay date to work backward
  const cycle = cycles.sort((a, b) => (a.nextPayDate || '').localeCompare(b.nextPayDate || ''))[0];
  if (!cycle?.nextPayDate || !cycle?.frequency) return null;

  const nextPay = new Date(cycle.nextPayDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If today IS payday, the new cycle starts today
  if (nextPay.getTime() === today.getTime()) {
    return todayISO();
  }

  // If nextPayDate is in the future, walk backward one cycle from it
  // That gives us the most recent payday (start of current cycle)
  let cycleStart = new Date(nextPay);
  switch (cycle.frequency) {
    case 'weekly': cycleStart.setDate(cycleStart.getDate() - 7); break;
    case 'biweekly': cycleStart.setDate(cycleStart.getDate() - 14); break;
    case 'semi-monthly': {
      const d = cycleStart.getDate();
      if (d <= 1) { cycleStart.setMonth(cycleStart.getMonth() - 1); cycleStart.setDate(15); }
      else if (d <= 15) { cycleStart.setDate(1); }
      else { cycleStart.setDate(15); }
      break;
    }
    case 'monthly': cycleStart.setMonth(cycleStart.getMonth() - 1); break;
    default: cycleStart.setDate(cycleStart.getDate() - 14);
  }

  return cycleStart.toISOString().split('T')[0];
}

// Calculate envelope status for an account
// Returns array of { categoryId, categoryName, budgeted, spent, remaining, percent }
export function calculateEnvelopeStatus(account, transactions, categories) {
  const envelopes = account.envelopes || [];
  if (envelopes.length === 0) return [];

  const cycleStart = getCurrentCycleStart(account);
  const today = todayISO();

  return envelopes
    .filter(env => env.isActive)
    .map(env => {
      const cat = categories.find(c => c.id === env.categoryId);

      // Sum spending in this category since cycle start
      const spent = transactions
        .filter(tx => {
          if (tx.isAdjustment) return false;
          if (tx.categoryId !== env.categoryId) return false;
          if (tx.amount >= 0) return false; // only expenses
          if (cycleStart && tx.date < cycleStart) return false;
          if (tx.date > today) return false;
          return true;
        })
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      const budgeted = env.amount;
      const remaining = Math.max(0, budgeted - spent);
      const overspent = spent > budgeted ? spent - budgeted : 0;
      const percent = budgeted > 0 ? Math.min(1, spent / budgeted) : 0;

      return {
        id: env.id,
        categoryId: env.categoryId,
        categoryName: cat?.name || 'Unknown',
        categoryColor: cat?.color || '#6B7280',
        note: env.note || '',
        budgeted,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        overspent: Math.round(overspent * 100) / 100,
        percent,
      };
    });
}

// Total remaining across all envelopes (what user still expects to spend)
export function getTotalEnvelopeRemaining(account, transactions, categories) {
  const statuses = calculateEnvelopeStatus(account, transactions, categories);
  return statuses.reduce((sum, s) => sum + s.remaining, 0);
}
