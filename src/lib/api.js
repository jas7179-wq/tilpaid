// src/lib/api.js
// API client for TilPaid cloud backend
// All requests require JWT auth except /auth routes

const API_BASE = (import.meta.env.VITE_API_URL || 'https://tilpaid-api-production.up.railway.app') + '/api';

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

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    // Network failure (offline, DNS, CORS block). Re-throw with a cleaner message.
    const err = new Error(`Network error: ${networkErr.message}`);
    err.isNetworkError = true;
    throw err;
  }

  if (response.status === 401) {
    clearToken();
    const err = new Error('Session expired. Please sign in again.');
    err.status = 401;
    throw err;
  }

  if (!response.ok) {
    // Read body once as text, then try to parse. Preserves raw text if it's not JSON
    // (e.g. when Railway's edge returns HTML error pages).
    const rawText = await response.text().catch(() => '');
    let body = {};
    try { body = JSON.parse(rawText); } catch { /* not JSON */ }

    // Backend uses { error: "..." } convention; also accept { message: "..." }.
    // Fall back to raw text snippet, then HTTP status.
    const message =
      body.error ||
      body.message ||
      (rawText && rawText.slice(0, 200)) ||
      `HTTP ${response.status}`;

    const err = new Error(message);
    err.status = response.status;
    err.responseBody = body;
    throw err;
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

export async function signInWithGoogle(credential) {
  // credential = { idToken, profile } from src/lib/auth.js
  const result = await post('/auth/google', { idToken: credential.idToken });
  if (result.token) setToken(result.token);
  return result;
}

export async function signInWithApple(credential) {
  // credential will be { identityToken, fullName } when Apple Sign-In is wired up
  const result = await post('/auth/apple', credential);
  if (result.token) setToken(result.token);
  return result;
}

export async function getProfile() {
  return get('/auth/me');
}

export async function signOut() {
  // Best-effort: tell the server to clear any cookie. Ignore network errors —
  // we're always going to clear the local token regardless.
  try {
    await post('/auth/logout');
  } catch {
    /* intentional: logout must succeed locally even if server is unreachable */
  }
  clearToken();
}

// Triggers server-side verification with RevenueCat REST API.
// Server is the authority — checks RC's entitlements directly and updates
// User.isPremium in the DB. Returns { isPremium, changed }.
//
// Called automatically after sign-in, after a purchase, and on app resume.
// Body is empty — server uses the JWT to identify the user, then asks RC
// using the same User.id as app_user_id.
export async function syncPremium() {
  return post('/auth/sync-premium', {});
}

// ── Memberships (Phase 2 — joint accounts) ──

export async function inviteToAccount(accountId) {
  return post('/memberships/invite', { accountId });
}

export async function joinAccount(code) {
  return post('/memberships/join', { code });
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
  // Backend route is PUT /api/settings/:key with body { value }
  return put(`/settings/${encodeURIComponent(key)}`, { value });
}

// ── Sync ──
// Full sync: push local state to cloud, pull cloud state to local
// Uses last-write-wins conflict resolution based on updatedAt timestamps

export async function syncPush(data) {
  return post('/sync/push', data);
}

export async function syncPull(lastSyncAt) {
  // Backend expects GET with ?since=<ISO timestamp> query param.
  // lastSyncAt is a Unix millisecond number (from Date.now()); convert to ISO for the URL.
  const since = lastSyncAt ? new Date(lastSyncAt).toISOString() : '';
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return get(`/sync/pull${query}`);
}
