import { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import * as db from '../lib/db';
import * as sync from '../lib/sync';
import * as api from '../lib/api';
import { computeRunningBalances, computeCurrentBalance, createTransaction, createAccount, createReconciliation } from '../lib/utils';

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
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    async function init() {
      await db.initDefaultCategories();
      const accounts = await db.getAccounts();
      const categories = await db.getCategories();
      const isSetupComplete = await db.getSetting('setupComplete');
      const isPremium = await db.getSetting('isPremium');
      const lastActiveAccountId = await db.getSetting('lastActiveAccountId');

      // Legacy global settings (fallback for existing users)
      const globalPayFrequency = await db.getSetting('payFrequency');
      const globalNextPayDate = await db.getSetting('nextPayDate');

      // Auto-advance payday on each account
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const account of accounts) {
        // Migrate: if account has no pay settings, pull from global
        if (!account.payFrequency && globalPayFrequency) {
          account.payFrequency = globalPayFrequency;
          account.nextPayDate = globalNextPayDate;
        }

        if (account.nextPayDate && account.payFrequency) {
          let payDateObj = new Date(account.nextPayDate + 'T00:00:00');
          let advanced = false;

          while (payDateObj < today) {
            advanced = true;
            switch (account.payFrequency) {
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

          if (advanced) {
            account.nextPayDate = payDateObj.toISOString().split('T')[0];
            account.updatedAt = Date.now();
            await db.saveAccount(account);
          }
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

      // Run initial cloud sync if signed in
      if (api.isAuthenticated()) {
        sync.initialSync().then(result => {
          if (result.success && result.pulled > 0) {
            // Re-init if cloud had changes
            init();
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

  const completeSetup = useCallback(async ({ accountName, accountType, balance, payFrequency, nextPayDate }) => {
    const account = createAccount({
      name: accountName, type: accountType, balance: parseFloat(balance),
      payFrequency, nextPayDate,
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
  }, [state.categories]);

  const switchAccount = useCallback(async (accountId) => {
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return;

    const transactions = await db.getTransactions(accountId);
    await db.saveSetting('lastActiveAccountId', accountId);

    dispatch({ type: 'SET_ACTIVE_ACCOUNT', payload: accountId });
    dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
    // Update pay settings from the new active account
    dispatch({
      type: 'INIT',
      payload: {
        ...state,
        activeAccountId: accountId,
        transactions,
        payFrequency: account.payFrequency || null,
        nextPayDate: account.nextPayDate || null,
        isLoading: false,
      },
    });
  }, [state]);

  const addNewAccount = useCallback(async ({ name, type, balance, payFrequency, nextPayDate }) => {
    if (!canAddAccount) {
      return { error: 'Upgrade to Premium to add more accounts' };
    }

    const account = createAccount({ name, type, balance: parseFloat(balance), payFrequency, nextPayDate });
    await db.saveAccount(account);

    dispatch({ type: 'ADD_ACCOUNT', payload: account });

    // Switch to the new account
    const transactions = await db.getTransactions(account.id);
    await db.saveSetting('lastActiveAccountId', account.id);
    dispatch({ type: 'SET_ACTIVE_ACCOUNT', payload: account.id });
    dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });

    return { success: true, account };
  }, [canAddAccount]);

  const deleteAccountById = useCallback(async (accountId) => {
    // Don't allow deleting the last account
    if (state.accounts.length <= 1) {
      return { error: 'Cannot delete your only account' };
    }

    // Delete all transactions for this account
    const allTx = await db.getTransactions(accountId);
    for (const tx of allTx) {
      await db.deleteTransaction(tx.id);
    }

    await db.deleteAccount(accountId);
    dispatch({ type: 'REMOVE_ACCOUNT', payload: accountId });

    // Switch to another account
    const remaining = state.accounts.filter(a => a.id !== accountId);
    if (remaining.length > 0) {
      await switchAccount(remaining[0].id);
    }

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
    const recon = createReconciliation({
      accountId: state.activeAccountId,
      balance: parseFloat(balance),
      matched,
    });
    await db.saveReconciliation(recon);

    const account = await db.getAccount(state.activeAccountId);
    const updated = { ...account, lastReconciledAt: Date.now(), updatedAt: Date.now() };
    await db.saveAccount(updated);
    dispatch({ type: 'UPDATE_ACCOUNT', payload: updated });

    if (!matched) {
      await adjustBalance({ newBalance: balance, note: 'Weekly reconciliation adjustment' });
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

    await db.deleteTransaction(id);
    await syncAccountBalance();
    return { success: true };
  }, [state.activeAccountId, lastAdjustment, syncAccountBalance]);

  const refreshTransactions = useCallback(async () => {
    if (!state.activeAccountId) return;
    await syncAccountBalance();
  }, [state.activeAccountId, syncAccountBalance]);

  const resetAccount = useCallback(async ({ newBalance }) => {
    if (!state.activeAccountId) return;

    const allTx = await db.getTransactions(state.activeAccountId);
    for (const tx of allTx) {
      await db.deleteTransaction(tx.id);
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
        // Pull cloud data after sign-in
        const syncResult = await sync.initialSync();
        if (syncResult.success && syncResult.pulled > 0) {
          window.location.reload(); // reload to pick up cloud data
        }
        // Update premium status from cloud
        if (result.user?.isPremium !== undefined) {
          await db.saveSetting('isPremium', result.user.isPremium);
          dispatch({ type: 'INIT', payload: { ...state, isPremium: result.user.isPremium, isLoading: false } });
        }
      }
      return result;
    } catch (err) {
      return { error: err.message };
    }
  }, [state]);

  const signOutUser = useCallback(async () => {
    await api.signOut();
    // Don't clear local data — just disconnect from cloud
  }, []);

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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
