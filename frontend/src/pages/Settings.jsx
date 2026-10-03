import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Lock,
  Settings2,
  Download,
  Trash2,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { api, setToken } from "../api";
import { useToast } from "../components/Toast";
import { initials, formatDate } from "../utils/format";

const AVATAR_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#ef4444",
  "#64748b",
];

const CURRENCIES = ["USD", "EUR", "GBP", "ETB", "KES", "NGN", "ZAR", "INR", "JPY", "CAD", "AUD"];

function SettingsSection({ icon: Icon, title, hint, open, onToggle, children }) {
  return (
    <section className={`settings-section ${open ? "open" : ""}`}>
      <button
        type="button"
        className="settings-section-head"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="settings-section-icon">
          <Icon size={16} />
        </span>
        <span className="settings-section-text">
          <span className="settings-section-title">{title}</span>
          {hint && <span className="settings-section-hint">{hint}</span>}
        </span>
        {open ? (
          <ChevronDown size={16} className="settings-section-chevron" />
        ) : (
          <ChevronRight size={16} className="settings-section-chevron" />
        )}
      </button>
      {open && <div className="settings-section-body">{children}</div>}
    </section>
  );
}

export default function Settings() {
  const { t, theme, setTheme, locale, setLocale } = useUI();
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [open, setOpen] = useState({
    profile: true,
    security: false,
    preferences: false,
    data: false,
  });
  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  // ---- Profile form ----
  const [pfName, setPfName] = useState(user?.full_name || "");
  const [pfEmail, setPfEmail] = useState(user?.email || "");
  const [pfPassword, setPfPassword] = useState("");
  const [pfColor, setPfColor] = useState(user?.avatar_color || AVATAR_COLORS[0]);
  const [pfBusy, setPfBusy] = useState(false);
  const [pfError, setPfError] = useState("");

  useEffect(() => {
    setPfName(user?.full_name || "");
    setPfEmail(user?.email || "");
    setPfColor(user?.avatar_color || AVATAR_COLORS[0]);
  }, [user]);

  const emailChanged =
    pfEmail.trim().toLowerCase() !== (user?.email || "").toLowerCase();

  const saveProfile = async (e) => {
    e.preventDefault();
    setPfBusy(true);
    setPfError("");
    try {
      const body = { fullName: pfName.trim(), avatarColor: pfColor };
      if (emailChanged) {
        body.email = pfEmail.trim();
        body.currentPassword = pfPassword;
      }
      const { user: updated } = await api.updateProfile(body);
      updateUser(updated);
      setPfPassword("");
      toast.success(t("profileUpdated"));
    } catch (err) {
      setPfError(err.message || t("profileUpdateError"));
    } finally {
      setPfBusy(false);
    }
  };

  // ---- Password form ----
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    if (pwNew.length < 6) {
      setPwError(t("passwordLength"));
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError(t("passwordsMismatch"));
      return;
    }
    setPwBusy(true);
    try {
      const { token } = await api.changePassword({
        currentPassword: pwCurrent,
        newPassword: pwNew,
      });
      setToken(token); // keep this session signed in
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      toast.success(t("passwordUpdated"));
    } catch (err) {
      setPwError(err.message || t("passwordChangeError"));
    } finally {
      setPwBusy(false);
    }
  };

  // ---- Session revocation ----
  const [revoking, setRevoking] = useState(false);
  const revokeSessions = async () => {
    setRevoking(true);
    try {
      const { token } = await api.revokeSessions();
      setToken(token);
      toast.success(t("sessionsRevoked"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRevoking(false);
    }
  };

  // ---- Currency ----
  const saveCurrency = async (code) => {
    try {
      const { user: updated } = await api.updateProfile({ currency: code });
      updateUser(updated);
      toast.success(t("profileUpdated"));
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ---- Export data ----
  const [exporting, setExporting] = useState(false);
  const exportData = async () => {
    setExporting(true);
    try {
      const rows = await api.getTransactions();
      const escape = (v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ["date", "description", "category", "type", "amount"]
        .map((k) => escape(t(k)))
        .join(",");
      const lines = rows.map((tx) =>
        [
          tx.transaction_date || "",
          tx.description || "",
          tx.category_name || "",
          tx.type,
          Number(tx.amount || 0).toFixed(2),
        ]
          .map(escape)
          .join(","),
      );
      const csv = [header, ...lines].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spendwise-data-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("dataExported"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  // ---- Delete account ----
  const [delPassword, setDelPassword] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState("");
  const canDelete = delConfirm.trim() === "DELETE" && delPassword.length > 0;

  const deleteAccount = async (e) => {
    e.preventDefault();
    setDelBusy(true);
    setDelError("");
    try {
      await api.deleteAccount({ currentPassword: delPassword });
      toast.success(t("accountDeleted"));
      logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setDelError(err.message || t("deleteAccountError"));
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("settings")}</h1>
          <p className="page-subtitle">{t("settingsSubtitle")}</p>
        </div>
      </div>

      <div className="settings-stack">
        <SettingsSection
          icon={User}
          title={t("account")}
          hint={t("accountHint")}
          open={open.profile}
          onToggle={() => toggle("profile")}
        >
          <div className="settings-user">
            <div className="avatar settings-avatar" style={{ background: pfColor }}>
              {initials(pfName || user?.full_name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="settings-name">{user?.full_name}</div>
              <div className="settings-email">{user?.email}</div>
              {user?.created_at && (
                <div className="settings-member">
                  {t("memberSince", { date: formatDate(user.created_at) })}
                </div>
              )}
            </div>
          </div>

          <form className="settings-form" onSubmit={saveProfile}>
            <div className="field">
              <label htmlFor="pf-name">{t("fullName")}</label>
              <input
                id="pf-name"
                className="input"
                value={pfName}
                onChange={(e) => setPfName(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="pf-email">{t("email")}</label>
              <input
                id="pf-email"
                className="input"
                type="email"
                value={pfEmail}
                onChange={(e) => setPfEmail(e.target.value)}
              />
            </div>

            {emailChanged && (
              <div className="field">
                <label htmlFor="pf-password">{t("currentPassword")}</label>
                <input
                  id="pf-password"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={pfPassword}
                  onChange={(e) => setPfPassword(e.target.value)}
                  placeholder={t("emailChangeRequiresPassword")}
                />
              </div>
            )}

            <div className="field">
              <span className="label-inline">{t("avatarColor")}</span>
              <div className="avatar-picker">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`avatar-swatch ${pfColor === c ? "active" : ""}`}
                    style={{ background: c }}
                    onClick={() => setPfColor(c)}
                    aria-label={`${t("avatarColor")} ${c}`}
                  />
                ))}
              </div>
            </div>

            {pfError && <div className="form-error">{pfError}</div>}

            <div className="settings-form-actions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={pfBusy || !pfName.trim()}
              >
                {pfBusy ? <span className="spinner spinner-sm" /> : null}
                {t("saveChanges")}
              </button>
            </div>
          </form>
        </SettingsSection>

        <SettingsSection
          icon={Lock}
          title={t("security")}
          hint={t("securityHint")}
          open={open.security}
          onToggle={() => toggle("security")}
        >
          <form className="settings-form" onSubmit={changePassword}>
            <div className="field">
              <label htmlFor="pw-current">{t("currentPassword")}</label>
              <input
                id="pw-current"
                className="input"
                type="password"
                autoComplete="current-password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pw-new">{t("newPassword")}</label>
              <input
                id="pw-new"
                className="input"
                type="password"
                autoComplete="new-password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pw-confirm">{t("confirm")}</label>
              <input
                id="pw-confirm"
                className="input"
                type="password"
                autoComplete="new-password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
              />
            </div>

            {pwError && <div className="form-error">{pwError}</div>}

            <div className="settings-form-actions">
              <button className="btn btn-primary" type="submit" disabled={pwBusy}>
                {pwBusy ? <span className="spinner spinner-sm" /> : null}
                {t("updatePassword")}
              </button>
            </div>
          </form>

          <div className="settings-divider" />

          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t("revokeSessions")}</div>
              <div className="settings-row-hint">{t("revokeSessionsHint")}</div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={revokeSessions}
              disabled={revoking}
            >
              {revoking ? <span className="spinner spinner-sm" /> : <LogOut size={14} />}
              {t("revokeSessions")}
            </button>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Settings2}
          title={t("preferences")}
          hint={t("preferencesHint")}
          open={open.preferences}
          onToggle={() => toggle("preferences")}
        >
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
        </SettingsSection>

        <SettingsSection
          icon={Download}
          title={t("dataAndPrivacy")}
          hint={t("dataAndPrivacyHint")}
          open={open.data}
          onToggle={() => toggle("data")}
        >
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t("exportData")}</div>
              <div className="settings-row-hint">{t("exportDataHint")}</div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={exportData}
              disabled={exporting}
            >
              {exporting ? <span className="spinner spinner-sm" /> : <Download size={14} />}
              {t("exportData")}
            </button>
          </div>

          <div className="settings-danger">
            <div className="settings-danger-head">
              <Trash2 size={16} />
              <div>
                <div className="settings-danger-title">{t("deleteAccount")}</div>
                <div className="settings-danger-hint">{t("deleteAccountHint")}</div>
              </div>
            </div>

            <form className="settings-form" onSubmit={deleteAccount}>
              <div className="field">
                <label htmlFor="del-password">{t("currentPassword")}</label>
                <input
                  id="del-password"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={delPassword}
                  onChange={(e) => setDelPassword(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="del-confirm">{t("typeDeleteToConfirm")}</label>
                <input
                  id="del-confirm"
                  className="input"
                  value={delConfirm}
                  onChange={(e) => setDelConfirm(e.target.value)}
                  placeholder="DELETE"
                />
              </div>

              {delError && <div className="form-error">{delError}</div>}

              <div className="settings-form-actions">
                <button
                  className="btn btn-danger"
                  type="submit"
                  disabled={!canDelete || delBusy}
                >
                  {delBusy ? <span className="spinner spinner-sm" /> : <Trash2 size={14} />}
                  {t("deleteAccount")}
                </button>
              </div>
            </form>
          </div>
        </SettingsSection>
      </div>
    </>
  );
}
