import { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import * as db from '../lib/db';
import * as sync from '../lib/sync';
import * as api from '../lib/api';
import * as rc from '../lib/purchases';
import * as auth from '../lib/auth';
import { computeRunningBalances, computeCurrentBalance, createTransaction, createAccount, advancePayCycleDate, getNextPayInfo } from '../lib/utils';
const AppContext = createContext(null);

const MAX_FREE_ACCOUNTS = 1;

const initialState = {
  accounts: [],
  activeAccountId: null,
  transactions: [],
  categories: [],
  isSetupComplete: false,
  isLoading: true,
  isPremium: false,
  payFrequency: null,
  nextPayDate: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload, isLoading: false };
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.payload };
    case 'SET_ACTIVE_ACCOUNT':
      return { ...state, activeAccountId: action.payload };
    case 'SET_TRANSACTIONS':
      return { ...state, transactions: action.payload };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'SET_SETUP_COMPLETE':
      return { ...state, isSetupComplete: true };
    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      };
    case 'ADD_ACCOUNT':
      return { ...state, accounts: [...state.accounts, action.payload] };
    case 'REMOVE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.payload),
      };
    case 'SET_PAY_SETTINGS':
      return {
        ...state,
        payFrequency: action.payload.payFrequency,
        nextPayDate: action.payload.nextPayDate,
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    async function init() {
      await db.initDefaultCategories();

      // Initialize RevenueCat (no-op on web)
      await rc.initRevenueCat();

      // Initialize Google Sign-In (no-op if already initialized)
      await auth.initGoogleAuth();

      const accounts = await db.getAccounts();
      const categories = await db.getCategories();
      const isSetupComplete = await db.getSetting('setupComplete');
      const lastActiveAccountId = await db.getSetting('lastActiveAccountId');

      // Check premium status: RevenueCat on native, fallback to IndexedDB on web
      let isPremium = false;
      if (rc.isNative()) {
        isPremium = await rc.checkPremiumStatus();
        // Sync to IndexedDB so rest of app can read it
        await db.saveSetting('isPremium', isPremium);
      } else {
        isPremium = await db.getSetting('isPremium');
      }

      // Re-verify with server when local says premium (catches stale-true after
      // sandbox / production sub expiration). Skipped when local says false —
      // free users can hit "Restore purchases" if they need to refresh upward.
      // Skipped when not signed in — server can't verify without a JWT.
      if (isPremium && api.isAuthenticated()) {
        try {
          const verified = await api.syncPremium();
          if (verified?.isPremium !== undefined && verified.isPremium !== isPremium) {
            isPremium = verified.isPremium;
            await db.saveSetting('isPremium', isPremium);
          }
        } catch (err) {
          // Server unreachable — proceed with local value, don't block app launch.
          console.warn('Premium sync on launch failed (non-fatal):', err);
        }
      }


      // Legacy global settings (fallback for existing users)
      const globalPayFrequency = await db.getSetting('payFrequency');
      const globalNextPayDate = await db.getSetting('nextPayDate');

      // Auto-advance payday on each account
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const account of accounts) {
        let accountChanged = false;

        // Migrate: if account has no pay settings, pull from global
        if (!account.payFrequency && globalPayFrequency) {
          account.payFrequency = globalPayFrequency;
          account.nextPayDate = globalNextPayDate;
        }

        // Migrate: if account has legacy single pay fields but no payCycles, create one
        if ((!account.payCycles || account.payCycles.length === 0) && account.payFrequency && account.nextPayDate) {
          account.payCycles = [{
            id: Math.random().toString(36).slice(2, 10),
            name: '',
            frequency: account.payFrequency,
            nextPayDate: account.nextPayDate,
          }];
          accountChanged = true;
        }

        // Auto-advance each pay cycle
        if (account.payCycles && account.payCycles.length > 0) {
          for (const cycle of account.payCycles) {
            if (cycle.nextPayDate && cycle.frequency) {
              const result = advancePayCycleDate(cycle.nextPayDate, cycle.frequency);
              if (result.advanced) {
                cycle.nextPayDate = result.date;
                accountChanged = true;
              }
            }
          }
          // Keep legacy fields in sync with the earliest cycle
          const nearest = account.payCycles
            .filter(c => c.nextPayDate)
            .sort((a, b) => a.nextPayDate.localeCompare(b.nextPayDate))[0];
          if (nearest) {
            account.payFrequency = nearest.frequency;
            account.nextPayDate = nearest.nextPayDate;
          }
        } else if (account.nextPayDate && account.payFrequency) {
          // Fallback for accounts without payCycles
          const result = advancePayCycleDate(account.nextPayDate, account.payFrequency);
          if (result.advanced) {
            account.nextPayDate = result.date;
            accountChanged = true;
          }
        }

        if (accountChanged) {
          account.updatedAt = Date.now();
          await db.saveAccount(account);
        }
      }

      let transactions = [];
      let activeAccountId = null;

      if (accounts.length > 0) {
        // Restore last active account or default to first
        activeAccountId = lastActiveAccountId && accounts.find(a => a.id === lastActiveAccountId)
          ? lastActiveAccountId
          : accounts[0].id;
        transactions = await db.getTransactions(activeAccountId);
      }

      // Derive pay settings from the active account
      const activeAcct = accounts.find(a => a.id === activeAccountId);
      const payFrequency = activeAcct?.payFrequency || globalPayFrequency || null;
      const nextPayDate = activeAcct?.nextPayDate || globalNextPayDate || null;

      dispatch({
        type: 'INIT',
        payload: {
          accounts,
          activeAccountId,
          transactions,
          categories,
          isSetupComplete: !!isSetupComplete,
          isPremium: !!isPremium,
          payFrequency,
          nextPayDate,
        },
      });

      // Run initial cloud sync if signed in (fire-and-forget)
      // pullAll writes cloud data to IndexedDB; UI will pick it up on next render.
      // We intentionally do NOT re-run init() here to avoid infinite sync loops.
     if (api.isAuthenticated()) {
       sync.initialSync().then(result => {
     if (!result.success) {
      console.warn('Initial sync failed:', result.error);
    }
  });
}
    }
    init();
  }, []);

  const activeAccount = state.accounts.find((a) => a.id === state.activeAccountId) || null;

  const transactionsWithBalances = activeAccount
    ? computeRunningBalances(state.transactions, activeAccount.startingBalance)
    : [];

  const currentBalance = activeAccount
    ? computeCurrentBalance(state.transactions, activeAccount.startingBalance)
    : 0;

  const lastAdjustment = (() => {
    const sorted = [...state.transactions].sort(
      (a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt
    );
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].isAdjustment) return sorted[i];
    }
    return null;
  })();

  const canAddAccount = state.isPremium || state.accounts.length < MAX_FREE_ACCOUNTS;

  // Helper to sync balance to IndexedDB
  const syncAccountBalance = useCallback(async () => {
    if (!state.activeAccountId) return;
    const transactions = await db.getTransactions(state.activeAccountId);
    const account = await db.getAccount(state.activeAccountId);
    if (!account) return;
    const bal = computeCurrentBalance(transactions, account.startingBalance);
    const updated = { ...account, currentBalance: bal, updatedAt: Date.now() };
    await db.saveAccount(updated);
    dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
    dispatch({ type: 'UPDATE_ACCOUNT', payload: updated });
    // Schedule cloud sync if signed in
    sync.scheduleSync();
  }, [state.activeAccountId]);

  // ── Actions ──

  const completeSetup = useCallback(async ({ accountName, accountType, balance, payFrequency, nextPayDate, payAmount }) => {
    const payCycles = payFrequency ? [{
      id: Math.random().toString(36).slice(2, 10),
      name: '',
      frequency: payFrequency,
      nextPayDate: nextPayDate || '',
      ...(payAmount ? { amount: parseFloat(payAmount) } : {}),
    }] : [];

    const account = createAccount({
      name: accountName, type: accountType, balance: parseFloat(balance),
      payFrequency, nextPayDate, payCycles,
    });
    await db.saveAccount(account);
    await db.saveSetting('setupComplete', true);
    await db.saveSetting('payFrequency', payFrequency); // keep global as fallback
    await db.saveSetting('lastActiveAccountId', account.id);
    if (nextPayDate) await db.saveSetting('nextPayDate', nextPayDate); // keep global as fallback

    dispatch({
      type: 'INIT',
      payload: {
        accounts: [account],
        activeAccountId: account.id,
        transactions: [],
        isSetupComplete: true,
        isPremium: false,
        payFrequency,
        nextPayDate,
        isLoading: false,
        categories: state.categories,
      },
    });

    // Push initial setup data to cloud if user is signed in
    sync.scheduleSync();
  }, [state.categories]);

  const switchAccount = useCallback(async (accountId) => {
  const account = state.accounts.find(a => a.id === accountId);
  if (!account) return;

  const transactions = await db.getTransactions(accountId);
  await db.saveSetting('lastActiveAccountId', accountId);

  // Dispatch specific actions only — do NOT re-spread state, which would
  // resurrect items removed by earlier dispatches in the same tick (e.g.,
  // REMOVE_ACCOUNT before switchAccount in the delete flow).
  dispatch({ type: 'SET_ACTIVE_ACCOUNT', payload: accountId });
  dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
  dispatch({
    type: 'SET_PAY_SETTINGS',
    payload: {
      payFrequency: account.payFrequency || null,
      nextPayDate: account.nextPayDate || null,
    },
  });
}, [state.accounts]);

  const addNewAccount = useCallback(async ({ name, type, balance, payFrequency, nextPayDate, payAmount }) => {
    if (!canAddAccount) {
      return { error: 'Upgrade to Premium to add more accounts' };
    }

    const payCycles = payFrequency ? [{
      id: Math.random().toString(36).slice(2, 10),
      name: '',
      frequency: payFrequency,
      nextPayDate: nextPayDate || '',
      ...(payAmount ? { amount: parseFloat(payAmount) } : {}),
    }] : [];

    const account = createAccount({ name, type, balance: parseFloat(balance), payFrequency, nextPayDate, payCycles });
    await db.saveAccount(account);

    dispatch({ type: 'ADD_ACCOUNT', payload: account });

    // Switch to the new account
    const transactions = await db.getTransactions(account.id);
    await db.saveSetting('lastActiveAccountId', account.id);
    dispatch({ type: 'SET_ACTIVE_ACCOUNT', payload: account.id });
    dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });

    // Push new account to cloud
    sync.scheduleSync();

    return { success: true, account };
  }, [canAddAccount]);

 const deleteAccountById = useCallback(async (accountId) => {
  // Don't allow deleting the last account
  if (state.accounts.length <= 1) {
    return { error: 'Cannot delete your only account' };
  }

  // Soft-delete the account: mark as deleted, don't hard-remove.
  // This lets the sync engine propagate the delete to the cloud.
  // The server will set isDeleted: true, and other devices will remove
  // it from their local DB on next pull.
  const account = await db.getAccount(accountId);
  if (account) {
    await db.saveAccount({
      ...account,
      isDeleted: true,
      updatedAt: Date.now(),
    });
  }

  // Soft-delete all transactions for this account too so sync can propagate.
  const allTx = await db.getTransactions(accountId);
  for (const tx of allTx) {
    await db.saveTransaction({
      ...tx,
      isDeleted: true,
      updatedAt: Date.now(),
    });
  }

  // Remove from in-memory state so the UI updates immediately.
  dispatch({ type: 'REMOVE_ACCOUNT', payload: accountId });

  // Switch to another account
  const remaining = state.accounts.filter(a => a.id !== accountId);
  if (remaining.length > 0) {
    await switchAccount(remaining[0].id);
  }

  // Push the soft-delete to cloud
  sync.scheduleSync();

  return { success: true };
}, [state.accounts, switchAccount]);

  const addTransaction = useCallback(async ({ amount, description, categoryId, date, type }) => {
    if (!state.activeAccountId) return;
    const tx = createTransaction({
      accountId: state.activeAccountId,
      amount: parseFloat(amount),
      description,
      categoryId,
      date,
      type,
    });
    await db.saveTransaction(tx);
    await syncAccountBalance();
  }, [state.activeAccountId, syncAccountBalance]);

  const adjustBalance = useCallback(async ({ newBalance, note }) => {
    if (!state.activeAccountId) return;
    const diff = parseFloat(newBalance) - currentBalance;
    if (Math.abs(diff) < 0.01) return;

    const tx = createTransaction({
      accountId: state.activeAccountId,
      amount: diff,
      description: 'Balance Adjustment',
      categoryId: 'adjustment',
      type: diff > 0 ? 'income' : 'expense',
      isAdjustment: true,
      note: note || '',
    });
    await db.saveTransaction(tx);
    await syncAccountBalance();
  }, [state.activeAccountId, currentBalance, syncAccountBalance]);

 const reconcile = useCallback(async ({ balance, matched }) => {
    if (!state.activeAccountId) return;
    
    // Update the account's lastReconciledAt timestamp
    const account = await db.getAccount(state.activeAccountId);
    const updated = { ...account, lastReconciledAt: Date.now(), updatedAt: Date.now() };
    await db.saveAccount(updated);
    dispatch({ type: 'UPDATE_ACCOUNT', payload: updated });

    if (!matched) {
      await adjustBalance({ newBalance: balance, note: 'Weekly reconciliation adjustment' });
      // adjustBalance → syncAccountBalance → scheduleSync, so we're covered
    } else {
      // No balance change, but we did update lastReconciledAt
      sync.scheduleSync();
    }
  }, [state.activeAccountId, adjustBalance]);

  const deleteTransactionById = useCallback(async (id) => {
    const tx = await db.getTransaction(id);
    if (tx && tx.isAdjustment) {
      return { error: 'Cannot delete a balance adjustment. It serves as an anchor point for your balance.' };
    }

    if (lastAdjustment && tx) {
      const txTime = new Date(tx.date).getTime() + (tx.createdAt || 0);
      const adjTime = new Date(lastAdjustment.date).getTime() + (lastAdjustment.createdAt || 0);
      if (txTime < adjTime) {
        return { error: 'Cannot delete transactions from before your last balance adjustment.' };
      }
    }

    // Soft-delete so the tombstone reaches the server
    if (tx) {
      await db.saveTransaction({
        ...tx,
        isDeleted: true,
        updatedAt: Date.now(),
      });
    }
    await syncAccountBalance();
    return { success: true };
  }, [state.activeAccountId, lastAdjustment, syncAccountBalance]);

  const refreshTransactions = useCallback(async () => {
    if (!state.activeAccountId) return;
    await syncAccountBalance();
  }, [state.activeAccountId, syncAccountBalance]);

 const resetAccount = useCallback(async ({ newBalance }) => {
    if (!state.activeAccountId) return;

    // Soft-delete each transaction so the tombstone reaches the server
    const allTx = await db.getTransactions(state.activeAccountId);
    for (const tx of allTx) {
      await db.saveTransaction({
        ...tx,
        isDeleted: true,
        updatedAt: Date.now(),
      });
    }

    const account = await db.getAccount(state.activeAccountId);
    const updated = {
      ...account,
      startingBalance: parseFloat(newBalance),
      currentBalance: parseFloat(newBalance),
      lastReconciledAt: null,
      updatedAt: Date.now(),
    };
    await db.saveAccount(updated);

    dispatch({ type: 'SET_TRANSACTIONS', payload: [] });
    dispatch({ type: 'UPDATE_ACCOUNT', payload: updated });

    // Push all the tombstones and updated balance to cloud
    sync.scheduleSync();
  }, [state.activeAccountId]);

  // ── Auth Actions ──
  const signIn = useCallback(async (provider, credential) => {
    try {
      let result;
      if (provider === 'apple') {
        result = await api.signInWithApple(credential);
      } else if (provider === 'google') {
        result = await api.signInWithGoogle(credential);
      }
      if (result?.token) {
        // Identify this user to RevenueCat so its webhooks carry our User.id
        // as app_user_id. Without this, RC tracks against an anonymous ID
        // that the server can't map back. Safe to call multiple times.
        if (result.user?.id) {
          await rc.setRevenueCatUser(result.user.id);
        }

        // Verify premium with the server (which checks RC REST API).
        // Catches the case where the user already had premium on a previous
        // device and the webhook hasn't fired on this install. Non-fatal.
        let verifiedPremium = null;
        try {
          verifiedPremium = await api.syncPremium();
        } catch (err) {
          console.warn('Premium sync failed (non-fatal):', err);
        }

        // Pull cloud data after sign-in
        const syncResult = await sync.initialSync();
        if (syncResult.success && syncResult.pulled > 0) {
          window.location.reload(); // reload to pick up cloud data
        }

        // Update premium status from server-verified result, falling back
        // to whatever the sign-in payload said (the /me cached value).
        const finalPremium = verifiedPremium?.isPremium ?? result.user?.isPremium;
        if (finalPremium !== undefined) {
          await db.saveSetting('isPremium', finalPremium);
          dispatch({ type: 'INIT', payload: { ...state, isPremium: finalPremium, isLoading: false } });
        }
      }
      return result;
    } catch (err) {
      return { error: err.message };
    }
  }, [state]);

  const signOutUser = useCallback(async () => {
    await api.signOut();
    // Clear RevenueCat identity so the next user signing in on this device
    // doesn't briefly inherit the previous user's entitlement state.
    await rc.clearRevenueCatUser();
    // Also clear the Capacitor GoogleAuth session — without this, the next
    // sign-in attempt silently re-uses the same Google account instead of
    // showing the account picker.
    await auth.signOutGoogle();
    // Don't clear local data — just disconnect from cloud
  }, []);

  // Re-check premium status. Server is the authority when signed in (asks RC
  // REST API and updates DB). Falls back to local SDK / IndexedDB otherwise.
  // Call after a purchase, on app resume, or when restoring purchases.
  const refreshPremium = useCallback(async () => {
    let isPremium = false;

    if (api.isAuthenticated()) {
      try {
        const result = await api.syncPremium();
        isPremium = !!result?.isPremium;
      } catch (err) {
        console.warn('Server premium sync failed, falling back to local:', err);
        isPremium = rc.isNative()
          ? await rc.checkPremiumStatus()
          : await db.getSetting('isPremium');
      }
    } else {
      // Not signed in — fall back to local SDK / IndexedDB.
      isPremium = rc.isNative()
        ? await rc.checkPremiumStatus()
        : await db.getSetting('isPremium');
    }

    await db.saveSetting('isPremium', isPremium);
    dispatch({ type: 'INIT', payload: { ...state, isPremium: !!isPremium, isLoading: false } });
    return isPremium;
  }, [state]);

  const isSignedIn = api.isAuthenticated();

  const value = {
    ...state,
    activeAccount,
    currentBalance,
    transactionsWithBalances,
    lastAdjustment,
    canAddAccount,
    isSignedIn,
    completeSetup,
    switchAccount,
    addNewAccount,
    deleteAccountById,
    addTransaction,
    adjustBalance,
    reconcile,
    deleteTransactionById,
    refreshTransactions,
    resetAccount,
    signIn,
    signOutUser,
    refreshPremium,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
