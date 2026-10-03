/* eslint-disable react-refresh/only-export-components -- context, provider
   and hook are intentionally colocated in one module. */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "../i18n";

const UIContext = createContext(null);
const THEME_KEY = "spendwise_theme";
const LOCALE_KEY = "spendwise_locale";

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem(THEME_KEY) || "dark";
}

function getInitialLocale() {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(LOCALE_KEY) || "en";
}

export function UIProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [locale, setLocale] = useState(getInitialLocale);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  const t = useMemo(
    () => (key, vars = {}) => {
      const translation =
        translations[locale]?.[key] || translations.en[key] || key;
      return Object.keys(vars).reduce(
        (text, varName) => text.replace(new RegExp(`\\{\\{${varName}\\}}`, "g"), vars[varName]),
        translation,
      );
    },
    [locale],
  );

  return (
    <UIContext.Provider value={{ theme, setTheme, locale, setLocale, t }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside <UIProvider>");
  return ctx;
}
