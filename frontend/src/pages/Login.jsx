import { useState } from "react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { useNavigate, Link } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { User, Lock } from "lucide-react";

export default function Login() {
  const { t } = useUI();
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.username.trim() || !form.password) {
      setError(t("usernamePasswordRequired"));
      return;
    }
    setBusy(true);
    try {
      await login(form.username.trim(), form.password);
      toast.success(t("welcomeBackToast"));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={t("welcomeBack")}
      footer={
        <>
          {t("dontHaveAccount")} <Link to="/register">{t("createOneFree")}</Link>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
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
              autoComplete="current-password"
            />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? <span className="spinner" style={{ borderColor: "rgba(255,255,255,.35)", borderTopColor: "#fff" }} /> : t("signIn")}
        </button>
      </form>
    </AuthShell>
  );
}
