// Lightweight fetch wrapper around the Express backend.
// In dev, /api is proxied by Vite to http://localhost:3000.
// In production, set VITE_API_URL to the deployed API base URL.

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

// Exported so realtime consumers (SSE stream) can target the same base.
export const API_BASE_URL = API_URL;

const TOKEN_KEY = "spendwise_token";
const USER_KEY = "spendwise_user";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};
export const storeUser = (u) =>
  u
    ? localStorage.setItem(USER_KEY, JSON.stringify(u))
    : localStorage.removeItem(USER_KEY);

async function request(path, { method = "GET", body, params } = {}) {
  const url = new URL(API_URL + path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Make sure the backend is running.");
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const isAuthCall =
      path.startsWith("/auth/login") || path.startsWith("/auth/register");
    if (res.status === 401 && !isAuthCall) {
      clearToken();
      storeUser(null);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  // Every endpoint returns JSON. If the body is missing or not JSON (e.g. a
  // proxy served an HTML page because the backend is down), surface a clear
  // message instead of letting the caller crash on undefined data.
  if (!text || data === null) {
    throw new Error(
      "The server returned an unexpected response. Make sure the backend is running and /api is proxied correctly.",
    );
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request("/auth/register", { method: "POST", body }),
  login: (body) => request("/auth/login", { method: "POST", body }),
  profile: () => request("/auth/profile"),
  updateProfile: (body) => request("/auth/profile", { method: "PUT", body }),
  changePassword: (body) => request("/auth/password", { method: "PUT", body }),
  revokeSessions: () => request("/auth/revoke-sessions", { method: "POST" }),
  deleteAccount: (body) => request("/auth/account", { method: "DELETE", body }),

  // Categories
  getCategories: () => request("/categories"),
  createCategory: (body) => request("/categories", { method: "POST", body }),
  updateCategory: (id, body) => request(`/categories/${id}`, { method: "PUT", body }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),

  // Transactions
  getTransactions: (params) => request("/transactions", { params }),
  createTransaction: (body) => request("/transactions", { method: "POST", body }),
  updateTransaction: (id, body) =>
    request(`/transactions/${id}`, { method: "PUT", body }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),

  // Budgets
  getBudgets: () => request("/budgets"),
  createBudget: (body) => request("/budgets", { method: "POST", body }),
  updateBudget: (id, body) => request(`/budgets/${id}`, { method: "PUT", body }),
  deleteBudget: (id) => request(`/budgets/${id}`, { method: "DELETE" }),

  // Dashboard
  dashboard: {
    summary: () => request("/dashboard/summary"),
    monthlyTrend: () => request("/dashboard/monthly-trend"),
    categoryBreakdown: () => request("/dashboard/category-breakdown"),
  },

  // AI Insights
  insights: {
    get: (params) => request("/insights", { params }),
    ask: (question) => request("/insights/ask", { method: "POST", body: { question } }),
  },

  // Demo Bank (simulation only)
  bank: {
    config: () => request("/bank/config"),
    providers: () => request("/bank/providers"),
    demoAccounts: (params) => request("/bank/demo/accounts", { params }),
    connections: () => request("/bank/connections"),
    createConnection: (body) =>
      request("/bank/connections", { method: "POST", body }),
    verifyConnection: (id, body) =>
      request(`/bank/connections/${id}/verify`, { method: "POST", body }),
    disconnectConnection: (id) =>
      request(`/bank/connections/${id}`, { method: "DELETE" }),
    accounts: () => request("/bank/accounts"),
    syncAccount: (id) =>
      request(`/bank/accounts/${id}/sync`, { method: "POST" }),
    simulateAccount: (id, body) =>
      request(`/bank/accounts/${id}/simulate`, { method: "POST", body }),
    demoSequence: (id) =>
      request(`/bank/accounts/${id}/demo`, { method: "POST" }),
  },
};
