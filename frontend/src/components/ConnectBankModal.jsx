import { useEffect, useMemo, useState } from "react";
import {
  Landmark,
  Check,
  ChevronLeft,
  Copy,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import Modal from "./Modal";
import { api } from "../api";
import { useToast } from "./Toast";
import { useUI } from "../context/UIContext";
import { validateDemoAccountNumber } from "../utils/demoAccount";
import { currency } from "../utils/format";

const STEP_INSTITUTION = 1;
const STEP_ACCOUNT = 2;
const STEP_OTP = 3;
const STEP_DONE = 4;

const ACCOUNT_ERROR_KEYS = {
  required: "bankAccountRequired",
  digits: "bankAccountDigitsOnly",
  length: "bankAccountLength",
  checksum: "bankAccountInvalid",
};

function DemoTag() {
  const { t } = useUI();
  return <span className="demo-tag">{t("demo")}</span>;
}

export default function ConnectBankModal({ open, onClose, onConnected }) {
  const { t } = useUI();
  const toast = useToast();

  const [step, setStep] = useState(STEP_INSTITUTION);
  const [institutions, setInstitutions] = useState([]);
  const [devMode, setDevMode] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [availableAccounts, setAvailableAccounts] = useState([]);

  const [accountNumber, setAccountNumber] = useState("");
  const [accountError, setAccountError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const [connection, setConnection] = useState(null);
  const [otpInfo, setOtpInfo] = useState(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const [doneAccount, setDoneAccount] = useState(null);

  // Load institutions + config every time the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStep(STEP_INSTITUTION);
    setSelectedInstitution(null);
    setAccountNumber("");
    setAccountError("");
    setConnection(null);
    setOtpInfo(null);
    setOtp("");
    setOtpError("");
    setDoneAccount(null);
    setAvailableAccounts([]);

    Promise.allSettled([api.bank.providers(), api.bank.config()]).then(
      ([providersRes, configRes]) => {
        if (cancelled) return;
        const providers = providersRes.status === "fulfilled"
          ? providersRes.value.providers
          : [];
        const demo = providers.find((p) => p.isSimulation) || providers[0];
        setInstitutions(demo?.institutions || []);
        if (configRes.status === "fulfilled") setDevMode(Boolean(configRes.value.devMode));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  const openStep = (inst) => {
    setSelectedInstitution(inst);
    setStep(STEP_ACCOUNT);
    api.bank
      .demoAccounts({ institutionId: inst.id })
      .then((data) => setAvailableAccounts(data.accounts || []))
      .catch(() => setAvailableAccounts([]));
  };

  const accountValidation = useMemo(
    () => validateDemoAccountNumber(accountNumber),
    [accountNumber],
  );

  const fillAccount = (number) => {
    setAccountNumber(number);
    setAccountError("");
  };

  const handleContinue = async () => {
    const { valid, code } = accountValidation;
    if (!valid) {
      setAccountError(t(ACCOUNT_ERROR_KEYS[code] || "bankAccountInvalid"));
      return;
    }
    setConnecting(true);
    setAccountError("");
    try {
      const data = await api.bank.createConnection({
        provider: "demo",
        accountNumber,
      });
      setConnection(data.connection);
      setOtpInfo(data.otp);
      setStep(STEP_OTP);
    } catch (err) {
      setAccountError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const requestNewCode = async () => {
    setResending(true);
    setOtpError("");
    try {
      const data = await api.bank.createConnection({
        provider: "demo",
        accountNumber,
      });
      setConnection(data.connection);
      setOtpInfo(data.otp);
      setOtp("");
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setOtpError(t("bankEnterSixDigitCode"));
      return;
    }
    setVerifying(true);
    setOtpError("");
    try {
      const data = await api.bank.verifyConnection(connection.id, { otp });
      setDoneAccount(data.account);
      setStep(STEP_DONE);
    } catch (err) {
      setOtpError(err.message);
      // An expired/consumed code means the session is gone — offer a fresh one.
      if (/expired|No verification code/i.test(err.message)) {
        setConnection(null);
        setOtpInfo(null);
      }
    } finally {
      setVerifying(false);
    }
  };

  const copyDevCode = () => {
    if (otpInfo?.devCode && navigator.clipboard) {
      navigator.clipboard.writeText(otpInfo.devCode);
      toast.success(t("bankCodeCopied"));
    }
  };

  const handleClose = () => {
    onClose();
  };

  const finish = () => {
    toast.success(t("bankConnectedToast"));
    onClose();
    onConnected?.();
  };

  const checklist = [
    t("bankCheckAccountVerified"),
    t("bankCheckAccountLinked"),
    t("bankCheckReady"),
    t("bankCheckCategoriesUpdated"),
    t("bankCheckDashboardSynced"),
  ];

  return (
    <Modal open={open} onClose={handleClose} title={t("connectDemoBank")} maxWidth={540}>
      <div className="bank-connect">
        <div className="bank-demo-banner">
          <ShieldCheck size={14} />
          {t("bankSimulationOnly")}
        </div>

        {/* Step 1 — choose institution */}
        {step === STEP_INSTITUTION && (
          <div className="bank-step">
            <p className="bank-step-hint">{t("bankChooseInstitution")}</p>
            <div className="bank-institution-grid">
              {institutions.map((inst) => (
                <button
                  key={inst.id}
                  className="bank-institution"
                  onClick={() => openStep(inst)}
                  type="button"
                >
                  <div className="bank-institution-icon">
                    <Landmark size={18} />
                  </div>
                  <div className="bank-institution-name">{inst.name}</div>
                  <DemoTag />
                </button>
              ))}
            </div>
            {institutions.length === 0 && (
              <div className="bank-step-empty">{t("bankNoInstitutions")}</div>
            )}
          </div>
        )}

        {/* Step 2 — enter account number */}
        {step === STEP_ACCOUNT && selectedInstitution && (
          <div className="bank-step">
            <div className="bank-step-head">
              <button
                className="icon-btn"
                onClick={() => setStep(STEP_INSTITUTION)}
                aria-label={t("back")}
                type="button"
              >
                <ChevronLeft size={17} />
              </button>
              <div>
                <div className="bank-step-title">{selectedInstitution.name}</div>
                <div className="bank-step-sub">{t("bankEnterAccountNumber")}</div>
              </div>
              <DemoTag />
            </div>

            <div className="field">
              <label htmlFor="bank-account-number">{t("bankAccountNumberLabel")}</label>
              <input
                id="bank-account-number"
                className="input bank-account-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="1234567890128"
                maxLength={13}
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value.replace(/\D/g, ""));
                  if (accountError) setAccountError("");
                }}
              />
              {accountNumber.length > 0 && !accountValidation.valid && (
                <div className="bank-field-hint invalid">
                  {t(ACCOUNT_ERROR_KEYS[accountValidation.code] || "bankAccountInvalid")}
                </div>
              )}
              {accountNumber.length === 13 && accountValidation.valid && (
                <div className="bank-field-hint valid">{t("bankAccountLooksValid")}</div>
              )}
              {accountError && <div className="form-error">{accountError}</div>}
            </div>

            {availableAccounts.length > 0 && (
              <div className="bank-available">
                <div className="bank-available-title">{t("bankAvailableDemoAccounts")}</div>
                {availableAccounts.map((a) => (
                  <button
                    key={a.accountNumber}
                    className="bank-available-row"
                    onClick={() => fillAccount(a.accountNumber)}
                    type="button"
                  >
                    <div>
                      <div className="bank-available-name">{a.name}</div>
                      <div className="bank-available-meta">
                        {a.accountNumberMasked} · {t(`bankAccountType${a.type}`)}
                      </div>
                    </div>
                    <div className="bank-available-balance">{currency(a.currentBalance)}</div>
                    <span className="bank-available-use">{t("bankUseAccount")}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="bank-step-actions">
              <button
                className="btn btn-primary"
                onClick={handleContinue}
                disabled={connecting}
                type="button"
              >
                {connecting ? <span className="spinner spinner-sm" /> : null}
                {connecting ? t("bankVerifyingAccount") : t("continue")}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — OTP verification */}
        {step === STEP_OTP && (
          <div className="bank-step">
            <div className="bank-step-head">
              <button
                className="icon-btn"
                onClick={() => setStep(STEP_ACCOUNT)}
                aria-label={t("back")}
                type="button"
              >
                <ChevronLeft size={17} />
              </button>
              <div>
                <div className="bank-step-title">{t("bankVerifyAccount")}</div>
                <div className="bank-step-sub">
                  {connection?.institution_name} ·{" "}
                  {t("bankSentCodeToAccount", {
                    account: accountNumber.replace(/\d(?=\d{4})/g, "•"),
                  })}
                </div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="bank-otp">{t("bankEnterVerificationCode")}</label>
              <input
                id="bank-otp"
                className="input bank-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (otpError) setOtpError("");
                }}
              />
              {otpError && <div className="form-error">{otpError}</div>}
            </div>

            {devMode && otpInfo?.devCode && (
              <div className="dev-code-box">
                <div>
                  <div className="dev-code-title">{t("bankDevCode")}</div>
                  <div className="dev-code-value">{otpInfo.devCode}</div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={copyDevCode}
                  type="button"
                >
                  <Copy size={13} />
                  {t("bankCopyCode")}
                </button>
              </div>
            )}

            <div className="bank-step-actions">
              <button
                className="btn btn-primary"
                onClick={handleVerify}
                disabled={verifying}
                type="button"
              >
                {verifying ? <span className="spinner spinner-sm" /> : null}
                {verifying ? t("bankVerifying") : t("verify")}
              </button>
              {!connection && (
                <button
                  className="btn btn-ghost"
                  onClick={requestNewCode}
                  disabled={resending}
                  type="button"
                >
                  {resending ? <span className="spinner spinner-sm" /> : <RefreshCw size={14} />}
                  {t("bankRequestNewCode")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 4 — connected */}
        {step === STEP_DONE && doneAccount && (
          <div className="bank-step bank-done">
            <div className="bank-done-check">
              <Check size={20} />
            </div>
            <div className="bank-done-title">{t("bankAccountConnected")}</div>
            <div className="bank-done-account">
              <div className="bank-done-name">{doneAccount.account_name}</div>
              <div className="bank-done-meta">
                {doneAccount.account_number_masked} · {t("bankAccountType" + doneAccount.account_type)}
              </div>
              <div className="bank-done-balance">{currency(doneAccount.current_balance)}</div>
            </div>

            <div className="bank-checklist">
              {checklist.map((label, i) => (
                <div className="bank-checklist-row" key={label} style={{ animationDelay: `${i * 120}ms` }}>
                  <span className="bank-checklist-check">
                    <Check size={12} />
                  </span>
                  {label}
                </div>
              ))}
            </div>

            <div className="bank-done-note">{t("bankReadyNote")}</div>

            <div className="bank-step-actions">
              <button className="btn btn-primary" onClick={finish} type="button">
                {t("bankDone")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
