import { useState } from "react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { useNavigate, Link } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { Mail, Lock, User } from "lucide-react";

export default function Register() {
  const { t } = useUI();
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.fullName.trim() || !form.username.trim() || !form.email || !form.password) {
      setError(t("allFieldsRequired"));
      return;
    }
    if (!/^[a-z0-9_.-]{3,20}$/i.test(form.username.trim())) {
      setError(t("usernameInvalid"));
      return;
    }
    if (form.password.length < 6) {
      setError(t("passwordLength"));
      return;
    }
    if (form.password !== form.confirm) {
      setError(t("passwordsMismatch"));
      return;
    }
    setBusy(true);
    try {
      await register(form.username.trim(), form.email.trim(), form.password, form.fullName.trim());
      toast.success(t("accountCreatedToast"));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={t("createAccount")}
      footer={
        <>
          {t("alreadyHaveAccount")} <Link to="/login">{t("signIn")}</Link>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label htmlFor="fullName">{t("fullName")}</label>
          <div className="input-wrap">
            <User size={16} className="input-icon" />
            <input
              id="fullName"
              className="input"
              type="text"
              placeholder={t("fullNamePlaceholder")}
              value={form.fullName}
              onChange={set("fullName")}
              autoComplete="name"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="username">{t("username")}</label>
          <div className="input-wrap">
            <User size={16} className="input-icon" />
            <input
              id="username"
              className="input"
              type="text"
              placeholder={t("usernamePlaceholder")}
              value={form.username}
              onChange={set("username")}
              autoComplete="username"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="email">{t("email")}</label>
          <div className="input-wrap">
            <Mail size={16} className="input-icon" />
            <input
              id="email"
              className="input"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="password">{t("password")}</label>
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input
                id="password"
                className="input"
                type="password"
                placeholder={t("passwordPlaceholder")}
                value={form.password}
                onChange={set("password")}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="confirm">{t("confirm")}</label>
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input
                id="confirm"
                className="input"
                type="password"
                placeholder={t("confirmPasswordPlaceholder")}
                value={form.confirm}
                onChange={set("confirm")}
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? <span className="spinner" style={{ borderColor: "rgba(255,255,255,.35)", borderTopColor: "#fff" }} /> : t("createAccount")}
        </button>
      </form>
    </AuthShell>
  );
}
