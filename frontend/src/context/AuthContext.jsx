/* eslint-disable react-refresh/only-export-components -- context, provider
   and hook are intentionally colocated in one module. */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, clearToken, getStoredUser, storeUser } from "../api";
import { setDisplayCurrency } from "../utils/format";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [initializing, setInitializing] = useState(() =>
    Boolean(localStorage.getItem("spendwise_token")),
  );

  // On first load, validate the stored token by fetching the profile.
  useEffect(() => {
    if (!localStorage.getItem("spendwise_token")) return;
    let cancelled = false;
    api
      .profile()
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        storeUser(profile);
        setDisplayCurrency(profile.currency);
      })
      .catch(() => {
        if (cancelled) return;
        clearToken();
        storeUser(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login({ username, password });
    setToken(data.token);
    setUser(data.user);
    storeUser(data.user);
    setDisplayCurrency(data.user.currency);
    return data.user;
  }, []);

  const register = useCallback(async (username, email, password, fullName) => {
    const data = await api.register({ username, email, password, fullName });
    setToken(data.token);
    setUser(data.user);
    storeUser(data.user);
    setDisplayCurrency(data.user.currency);
    return data.user;
  }, []);

  // Keep a locally cached user (restores currency/avatar on reload too).
  useEffect(() => {
    const cached = getStoredUser();
    if (cached?.currency) setDisplayCurrency(cached.currency);
  }, []);

  const updateUser = useCallback((next) => {
    setUser(next);
    storeUser(next);
    if (next?.currency) setDisplayCurrency(next.currency);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    storeUser(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
