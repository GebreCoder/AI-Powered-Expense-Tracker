import { Sun, Moon } from "lucide-react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { useToast } from "../components/Toast";

const CURRENCIES = ["USD", "EUR", "GBP", "ETB", "KES", "NGN", "ZAR", "INR", "JPY", "CAD", "AUD"];

export default function SettingsPreferences() {
  const { t, theme, setTheme, locale, setLocale } = useUI();
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const saveCurrency = async (code) => {
    try {
      const { user: updated } = await api.updateProfile({ currency: code });
      updateUser(updated);
      toast.success(t("profileUpdated"));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("preferences")}</h1>
          <p className="page-subtitle">{t("preferencesHint")}</p>
        </div>
      </div>

      <div className="settings-stack">
        <div className="card settings-page-card">
          <div className="settings-body">
            <div className="settings-row">
              <div>
                <div className="settings-row-label">{t("theme")}</div>
                <div className="settings-row-hint">{t("toggleTheme")}</div>
              </div>
              <div className="segmented settings-segmented">
                <button
                  type="button"
                  className={theme === "light" ? "active" : ""}
                  onClick={() => setTheme("light")}
                >
                  <Sun size={14} />
                  {t("lightMode")}
                </button>
                <button
                  type="button"
                  className={theme === "dark" ? "active" : ""}
                  onClick={() => setTheme("dark")}
                >
                  <Moon size={14} />
                  {t("darkMode")}
                </button>
              </div>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">{t("language")}</div>
                <div className="settings-row-hint">{t("changeLanguage")}</div>
              </div>
              <select
                className="select settings-lang"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                aria-label={t("language")}
              >
                <option value="en">{t("english")}</option>
                <option value="am">{t("amharic")}</option>
              </select>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">{t("currency")}</div>
                <div className="settings-row-hint">{t("currencyHint")}</div>
              </div>
              <select
                className="select settings-lang"
                value={user?.currency || "USD"}
                onChange={(e) => saveCurrency(e.target.value)}
                aria-label={t("currency")}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
