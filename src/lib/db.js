import { openDB } from 'idb';

const DB_NAME = 'tilpaid';
const DB_VERSION = 2;

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Version 1 stores
        if (!db.objectStoreNames.contains('accounts')) {
          const accountStore = db.createObjectStore('accounts', { keyPath: 'id' });
          accountStore.createIndex('type', 'type');
        }

        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('accountId', 'accountId');
          txStore.createIndex('date', 'date');
          txStore.createIndex('category', 'category');
          txStore.createIndex('accountDate', ['accountId', 'date']);
        }

        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('reconciliations')) {
          const reconStore = db.createObjectStore('reconciliations', { keyPath: 'id' });
          reconStore.createIndex('accountId', 'accountId');
          reconStore.createIndex('date', 'date');
        }

        // Version 2: Recurring transactions
        if (!db.objectStoreNames.contains('recurring')) {
          const recurStore = db.createObjectStore('recurring', { keyPath: 'id' });
          recurStore.createIndex('accountId', 'accountId');
          recurStore.createIndex('type', 'type');
        }
      },
    });
  }
  return dbPromise;
}

// ── Accounts ──

export async function getAccounts() {
  const db = await getDB();
  return db.getAll('accounts');
}

export async function getAccount(id) {
  const db = await getDB();
  return db.get('accounts', id);
}

export async function saveAccount(account) {
  const db = await getDB();
  await db.put('accounts', account);
  return account;
}

export async function deleteAccount(id) {
  const db = await getDB();
  await db.delete('accounts', id);
}

// ── Transactions ──

export async function getTransactions(accountId) {
  const db = await getDB();
  const all = await db.getAllFromIndex('transactions', 'accountId', accountId);
  return all.sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
}

export async function getTransaction(id) {
  const db = await getDB();
  return db.get('transactions', id);
}

export async function saveTransaction(transaction) {
  const db = await getDB();
  await db.put('transactions', transaction);
  return transaction;
}

export async function deleteTransaction(id) {
  const db = await getDB();
  await db.delete('transactions', id);
}

// ── Categories ──

export const DEFAULT_CATEGORIES = [
  // ── Everyday spending (high frequency) ──
  { id: 'cat-groceries', name: 'Groceries', color: '#1D9E75', icon: 'ShoppingCart' },
  { id: 'cat-dining', name: 'Dining', color: '#D85A30', icon: 'UtensilsCrossed' },
  { id: 'cat-fuel', name: 'Gas', color: '#378ADD', icon: 'Fuel' },
  { id: 'cat-shopping', name: 'Shopping', color: '#534AB7', icon: 'ShoppingBag' },
  { id: 'cat-transport', name: 'Transportation', color: '#5F7A5A', icon: 'Car' },

  // ── Monthly bills ──
  { id: 'cat-rent', name: 'Rent / Mortgage', color: '#993556', icon: 'Home' },
  { id: 'cat-bills', name: 'Bills & Utilities', color: '#BA7517', icon: 'Zap' },
  { id: 'cat-subscriptions', name: 'Subscriptions', color: '#854F0B', icon: 'Repeat' },

  // ── Life categories ──
  { id: 'cat-health', name: 'Health', color: '#E24B4A', icon: 'Heart' },
  { id: 'cat-entertainment', name: 'Entertainment', color: '#7F77DD', icon: 'Ticket' },
  { id: 'cat-kids', name: 'Kids & Family', color: '#D4537E', icon: 'Baby' },
  { id: 'cat-pets', name: 'Pets', color: '#639922', icon: 'PawPrint' },
  { id: 'cat-personal', name: 'Personal', color: '#0F6E56', icon: 'User' },

  // ── Income ──
  { id: 'cat-paycheck', name: 'Paycheck', color: '#1D9E75', icon: 'Banknote', isIncome: true, isPaycheck: true },
  { id: 'cat-income', name: 'Income', color: '#1D9E75', icon: 'DollarSign', isIncome: true },
  { id: 'cat-refund', name: 'Refund', color: '#2ECC71', icon: 'RotateCcw', isIncome: true },

  // ── Catch-all ──
  { id: 'cat-other', name: 'Other', color: '#6B7280', icon: 'MoreHorizontal' },
];

export async function getCategories() {
  const db = await getDB();
  const cats = await db.getAll('categories');
  return cats.length > 0 ? cats : DEFAULT_CATEGORIES;
}

export async function saveCategory(category) {
  const db = await getDB();
  await db.put('categories', category);
  return category;
}

export async function deleteCategory(id) {
  const db = await getDB();
  await db.delete('categories', id);
}

export async function initDefaultCategories() {
  const db = await getDB();
  const existing = await db.getAll('categories');

  if (existing.length === 0) {
    // Fresh install — seed all defaults
    const tx = db.transaction('categories', 'readwrite');
    for (const cat of DEFAULT_CATEGORIES) {
      await tx.store.put(cat);
    }
    await tx.done;
  } else {
    // Existing install — add any missing default categories
    const existingIds = new Set(existing.map((c) => c.id));
    const missing = DEFAULT_CATEGORIES.filter((c) => !existingIds.has(c.id));
    if (missing.length > 0) {
      const tx = db.transaction('categories', 'readwrite');
      for (const cat of missing) {
        await tx.store.put(cat);
      }
      await tx.done;
    }
  }
}

// ── Settings ──

export async function getSetting(key) {
  const db = await getDB();
  const result = await db.get('settings', key);
  return result?.value;
}

export async function saveSetting(key, value) {
  const db = await getDB();
  await db.put('settings', { key, value });
}

// ── Reconciliations ──

export async function getReconciliations(accountId) {
  const db = await getDB();
  return db.getAllFromIndex('reconciliations', 'accountId', accountId);
}

export async function saveReconciliation(reconciliation) {
  const db = await getDB();
  await db.put('reconciliations', reconciliation);
  return reconciliation;
}

// ── Utility ──

export async function clearAllData() {
  const db = await getDB();
  const stores = ['accounts', 'transactions', 'categories', 'settings', 'reconciliations', 'recurring'];
  for (const store of stores) {
    if (db.objectStoreNames.contains(store)) {
      await db.clear(store);
    }
  }
}

// ── Recurring Transactions ──

export async function getRecurringTransactions(accountId) {
  const db = await getDB();
  return db.getAllFromIndex('recurring', 'accountId', accountId);
}

export async function getRecurringTransaction(id) {
  const db = await getDB();
  return db.get('recurring', id);
}

export async function saveRecurringTransaction(recurring) {
  const db = await getDB();
  await db.put('recurring', recurring);
  return recurring;
}

export async function deleteRecurringTransaction(id) {
  const db = await getDB();
  await db.delete('recurring', id);
}

// ── Auto-suggest ──

export async function getUniqueDescriptions(accountId) {
  const db = await getDB();
  const all = await db.getAllFromIndex('transactions', 'accountId', accountId);

  // Build a map of description -> { count, lastCategoryId, lastAmount }
  const descMap = {};
  for (const tx of all) {
    if (!tx.description || tx.isAdjustment) continue;
    const key = tx.description.toLowerCase();
    if (!descMap[key]) {
      descMap[key] = {
        description: tx.description,
        count: 0,
        lastCategoryId: tx.categoryId,
        lastAmount: Math.abs(tx.amount),
        lastType: tx.type || (tx.amount >= 0 ? 'income' : 'expense'),
      };
    }
    descMap[key].count++;
    // Keep the most recent entry's data
    if (tx.createdAt > (descMap[key].lastCreatedAt || 0)) {
      descMap[key].lastCategoryId = tx.categoryId;
      descMap[key].lastAmount = Math.abs(tx.amount);
      descMap[key].lastType = tx.type || (tx.amount >= 0 ? 'income' : 'expense');
      descMap[key].lastCreatedAt = tx.createdAt;
    }
  }

  // Sort by frequency (most used first)
  return Object.values(descMap).sort((a, b) => b.count - a.count);
}