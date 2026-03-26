// src/lib/sync.js
// Sync service for TilPaid
// Local-first: IndexedDB is always the source of truth
// Cloud sync is optional (premium feature) and uses last-write-wins

import * as api from './api';
import * as db from './db';

const SYNC_KEY = 'tilpaid_last_sync';

// ── Sync State ──

function getLastSyncTime() {
  const val = localStorage.getItem(SYNC_KEY);
  return val ? parseInt(val, 10) : 0;
}

function setLastSyncTime(timestamp) {
  localStorage.setItem(SYNC_KEY, String(timestamp));
}

// ── Full Push ──
// Sends all local data to the cloud
// Used on first sync or when explicitly requested

export async function pushAll() {
  if (!api.isAuthenticated()) return { success: false, error: 'Not signed in' };

  try {
    const accounts = await db.getAccounts();
    const categories = await db.getCategories();

    // Get transactions and recurring for all accounts
    const allTransactions = [];
    const allRecurring = [];
    for (const account of accounts) {
      const txs = await db.getTransactions(account.id);
      allTransactions.push(...txs);
      const recs = await db.getRecurringTransactions(account.id);
      allRecurring.push(...recs);
    }

    // Get settings
    const settingKeys = ['payFrequency', 'nextPayDate', 'setupComplete', 'isPremium', 'warningThreshold'];
    const settings = {};
    for (const key of settingKeys) {
      const val = await db.getSetting(key);
      if (val !== undefined) settings[key] = val;
    }

    const payload = {
      accounts,
      transactions: allTransactions,
      recurringTransactions: allRecurring,
      categories,
      settings,
      timestamp: Date.now(),
    };

    const result = await api.syncPush(payload);
    setLastSyncTime(Date.now());
    return { success: true, result };
  } catch (err) {
    console.error('Push sync failed:', err);
    return { success: false, error: err.message };
  }
}

// ── Full Pull ──
// Pulls all data from cloud and merges into local
// Uses last-write-wins: newer updatedAt wins

export async function pullAll() {
  if (!api.isAuthenticated()) return { success: false, error: 'Not signed in' };

  try {
    const lastSync = getLastSyncTime();
    const cloudData = await api.syncPull(lastSync);

    if (!cloudData) return { success: true, changes: 0 };

    let changes = 0;

    // Merge accounts
    if (cloudData.accounts?.length) {
      const localAccounts = await db.getAccounts();
      const localMap = new Map(localAccounts.map(a => [a.id, a]));

      for (const cloudAcct of cloudData.accounts) {
        const local = localMap.get(cloudAcct.id);
        if (!local || (cloudAcct.updatedAt || 0) > (local.updatedAt || 0)) {
          await db.saveAccount(cloudAcct);
          changes++;
        }
      }
    }

    // Merge transactions
    if (cloudData.transactions?.length) {
      for (const cloudTx of cloudData.transactions) {
        const localTx = await db.getTransaction(cloudTx.id);
        if (!localTx || (cloudTx.updatedAt || 0) > (localTx.updatedAt || 0)) {
          if (cloudTx.deletedAt) {
            await db.deleteTransaction(cloudTx.id);
          } else {
            await db.saveTransaction(cloudTx);
          }
          changes++;
        }
      }
    }

    // Merge recurring transactions
    if (cloudData.recurringTransactions?.length) {
      for (const cloudRec of cloudData.recurringTransactions) {
        const localRec = await db.getRecurringTransaction(cloudRec.id);
        if (!localRec || (cloudRec.updatedAt || 0) > (localRec.updatedAt || 0)) {
          if (cloudRec.deletedAt) {
            await db.deleteRecurringTransaction(cloudRec.id);
          } else {
            await db.saveRecurringTransaction(cloudRec);
          }
          changes++;
        }
      }
    }

    // Merge categories
    if (cloudData.categories?.length) {
      for (const cloudCat of cloudData.categories) {
        const localCat = (await db.getCategories()).find(c => c.id === cloudCat.id);
        if (!localCat || (cloudCat.updatedAt || 0) > (localCat.updatedAt || 0)) {
          await db.saveCategory(cloudCat);
          changes++;
        }
      }
    }

    // Merge settings
    if (cloudData.settings) {
      for (const [key, value] of Object.entries(cloudData.settings)) {
        await db.saveSetting(key, value);
        changes++;
      }
    }

    setLastSyncTime(Date.now());
    return { success: true, changes };
  } catch (err) {
    console.error('Pull sync failed:', err);
    return { success: false, error: err.message };
  }
}

// ── Auto Sync ──
// Called after any local write operation (add, edit, delete)
// Debounced to avoid hammering the API

let syncTimer = null;

export function scheduleSync(delayMs = 3000) {
  if (!api.isAuthenticated()) return;

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    await pushAll();
  }, delayMs);
}

// ── Initial Sync ──
// Called on app load after sign-in
// Pull first (get any changes from other devices), then push local changes

export async function initialSync() {
  if (!api.isAuthenticated()) return { success: false, error: 'Not signed in' };

  try {
    // Pull cloud changes first
    const pullResult = await pullAll();
    if (!pullResult.success) {
      console.warn('Pull failed during initial sync:', pullResult.error);
    }

    // Then push local state
    const pushResult = await pushAll();
    if (!pushResult.success) {
      console.warn('Push failed during initial sync:', pushResult.error);
    }

    return {
      success: true,
      pulled: pullResult.changes || 0,
      pushed: pushResult.success,
    };
  } catch (err) {
    console.error('Initial sync failed:', err);
    return { success: false, error: err.message };
  }
}

// ── Sync Status ──

export function getSyncStatus() {
  const lastSync = getLastSyncTime();
  const isSignedIn = api.isAuthenticated();

  if (!isSignedIn) return { status: 'offline', lastSync: null };
  if (!lastSync) return { status: 'never', lastSync: null };

  const age = Date.now() - lastSync;
  const FIVE_MINUTES = 5 * 60 * 1000;

  return {
    status: age < FIVE_MINUTES ? 'synced' : 'stale',
    lastSync: new Date(lastSync),
    ageMs: age,
  };
}
