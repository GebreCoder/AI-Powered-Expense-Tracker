import { useState } from "react";
import { LogOut } from "lucide-react";
import { useUI } from "../context/UIContext";
import { api, setToken } from "../api";
import { useToast } from "../components/Toast";

export default function SettingsSecurity() {
  const { t } = useUI();
  const toast = useToast();

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

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("security")}</h1>
          <p className="page-subtitle">{t("securityHint")}</p>
        </div>
      </div>

      <div className="settings-stack">
        <div className="card settings-page-card">
          <div className="settings-body">
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
          </div>
        </div>
      </div>
    </>
  );
}
