// src/lib/api.js
// API client for TilPaid cloud backend
// All requests require JWT auth except /auth routes

const API_BASE = import.meta.env.VITE_API_URL || 'https://tilpaid-api-production.up.railway.app';

let authToken = null;

// ── Token Management ──

export function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('tilpaid_token', token);
  } else {
    localStorage.removeItem('tilpaid_token');
  }
}

export function getToken() {
  if (!authToken) {
    authToken = localStorage.getItem('tilpaid_token');
  }
  return authToken;
}

export function clearToken() {
  authToken = null;
  localStorage.removeItem('tilpaid_token');
}

export function isAuthenticated() {
  return !!getToken();
}

// ── HTTP Helpers ──

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

function get(path) {
  return request(path);
}

function post(path, data) {
  return request(path, { method: 'POST', body: JSON.stringify(data) });
}

function put(path, data) {
  return request(path, { method: 'PUT', body: JSON.stringify(data) });
}

function del(path) {
  return request(path, { method: 'DELETE' });
}

// ── Auth ──

export async function signInWithApple(identityToken) {
  const result = await post('/auth/apple', { identityToken });
  if (result.token) setToken(result.token);
  return result;
}

export async function signInWithGoogle(credential) {
  const result = await post('/auth/google', { credential });
  if (result.token) setToken(result.token);
  return result;
}

export async function getProfile() {
  return get('/auth/profile');
}

export async function signOut() {
  clearToken();
}

// ── Accounts ──

export async function getAccounts() {
  return get('/accounts');
}

export async function createAccount(account) {
  return post('/accounts', account);
}

export async function updateAccount(id, data) {
  return put(`/accounts/${id}`, data);
}

export async function deleteAccount(id) {
  return del(`/accounts/${id}`);
}

// ── Transactions ──

export async function getTransactions(accountId) {
  return get(`/transactions?accountId=${accountId}`);
}

export async function createTransaction(transaction) {
  return post('/transactions', transaction);
}

export async function updateTransaction(id, data) {
  return put(`/transactions/${id}`, data);
}

export async function deleteTransaction(id) {
  return del(`/transactions/${id}`);
}

// ── Recurring Transactions ──

export async function getRecurringTransactions(accountId) {
  return get(`/recurring?accountId=${accountId}`);
}

export async function createRecurringTransaction(recurring) {
  return post('/recurring', recurring);
}

export async function updateRecurringTransaction(id, data) {
  return put(`/recurring/${id}`, data);
}

export async function deleteRecurringTransaction(id) {
  return del(`/recurring/${id}`);
}

// ── Categories ──

export async function getCategories() {
  return get('/categories');
}

export async function saveCategory(category) {
  if (category.id) {
    return put(`/categories/${category.id}`, category);
  }
  return post('/categories', category);
}

export async function deleteCategory(id) {
  return del(`/categories/${id}`);
}

// ── Settings ──

export async function getSettings() {
  return get('/settings');
}

export async function saveSetting(key, value) {
  return put('/settings', { key, value });
}

// ── Sync ──
// Full sync: push local state to cloud, pull cloud state to local
// Uses last-write-wins conflict resolution based on updatedAt timestamps

export async function syncPush(data) {
  return post('/sync/push', data);
}

export async function syncPull(lastSyncAt) {
  return post('/sync/pull', { lastSyncAt });
}
