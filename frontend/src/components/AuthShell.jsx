import { useUI } from "../context/UIContext";
import { ShieldCheck } from "lucide-react";

export default function AuthShell({ title, subtitle, children, footer }) {
  const { t } = useUI();

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand">
          <img src="/logo.svg" alt="AI Powered Expense Tracker" className="brand-logo-img" />
          <span className="brand-name">AI Powered Expense Tracker</span>
        </div>

        <div className="auth-card">
          <div className="auth-heading">
            <h1>{title}</h1>
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="auth-link-row">{footer}</div>}
        </div>

        <div className="auth-trust">
          <ShieldCheck size={13} />
          <span>{t("privateSecured")}</span>
        </div>
      </div>
    </div>
  );
}
