import { useCallback, useEffect, useState } from "react";
import {
  Landmark,
  Plus,
  RefreshCw,
  Unplug,
  ShieldCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Play,
} from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { useUI } from "../context/UIContext";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import ConnectBankModal from "../components/ConnectBankModal";
import MaskedAmount from "../components/MaskedAmount";
import useLiveRefresh from "../hooks/useLiveRefresh";
import { DATA_CHANGED_EVENT } from "../hooks/useBankEvents";

function timeAgo(iso) {
  if (!iso) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function DemoTag() {
  const { t } = useUI();
  return <span className="demo-tag">{t("demo")}</span>;
}

export default function Banking() {
  const { t } = useUI();
  const toast = useToast();

  const [config, setConfig] = useState(null);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [simulatingId, setSimulatingId] = useState(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);
  const [disconnectBusy, setDisconnectBusy] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const [cfg, conns] = await Promise.all([
        api.bank.config(),
        api.bank.connections(),
      ]);
      setConfig(cfg);
      setConnections(conns);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh(() => load({ silent: true }), { interval: 30000 });

  // Real-time: new bank events (simulator, sync, simulate) refresh this page.
  useEffect(() => {
    const handler = () => load({ silent: true });
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
  }, [load]);

  const handleSync = async (account) => {
    setSyncingId(account.id);
    try {
      const result = await api.bank.syncAccount(account.id);
      toast.success(
        result.imported > 0
          ? t("bankSyncImported", { count: result.imported })
          : t("bankSyncUpToDate"),
      );
      await load({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSimulate = async (account, type) => {
    setSimulatingId(account.id);
    try {
      const result = await api.bank.simulateAccount(account.id, { type });
      toast.success(
        t("bankSimulatedToast", {
          type: type === "income" ? t("incomeLabel") : t("expenseLabel"),
          name: result.posted?.merchantName || "",
        }),
      );
      await load({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSimulatingId(null);
    }
  };

  const handleDemoSequence = async () => {
    const target = connected[0]?.accounts?.[0];
    if (!target || demoRunning) return;
    setDemoRunning(true);
    try {
      await api.bank.demoSequence(target.id);
      toast.success(t("bankDemoSequenceStarted"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDemoRunning(false);
    }
  };

  const confirmDisconnect = async () => {
    if (!disconnecting) return;
    setDisconnectBusy(true);
    try {
      await api.bank.disconnectConnection(disconnecting.id);
      toast.success(t("bankDisconnectedToast"));
      setDisconnecting(null);
      await load({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDisconnectBusy(false);
    }
  };

  const connected = connections.filter((c) => c.status === "connected");

  if (loading) {
    return (
      <div className="panel-skeleton">
        <div className="skeleton-block" style={{ height: 180 }} />
        <div className="skeleton-block" style={{ height: 180 }} />
      </div>
    );
  }

  if (config && !config.enabled) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={t("bankDemoDisabled")}
        text={t("bankDemoDisabledText")}
      />
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("bankAccounts")}</h1>
          <p className="page-subtitle">{t("bankAccountsSubtitle")}</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setConnectOpen(true)}
            type="button"
          >
            <Plus size={16} />
            {t("connectBank")}
          </button>
        </div>
      </div>

      {error && (
        <div className="form-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Simulation status + presenter control */}
      <section className="bank-sim-panel">
        <div className="bank-sim-status">
          <span className={`live-dot ${config?.simulationEnabled ? "on" : ""}`} />
          <div>
            <div className="bank-sim-title">
              {config?.simulationEnabled ? t("bankSimulationRunning") : t("bankSimulationPaused")}
            </div>
            <div className="bank-sim-hint">
              {config?.simulationEnabled
                ? t("bankSimulationInterval", { seconds: config.transactionInterval })
                : t("bankSimulationPausedHint")}
            </div>
          </div>
        </div>
        <div className="bank-sim-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDemoSequence}
            disabled={demoRunning || connected.length === 0}
            title={
              connected.length === 0 ? t("bankDemoSequenceNeedsAccount") : ""
            }
            type="button"
          >
            {demoRunning ? (
              <span className="spinner spinner-sm" />
            ) : (
              <Play size={13} />
            )}
            {demoRunning ? t("bankDemoSequenceRunning") : t("bankDemoSequence")}
          </button>
          <DemoTag />
        </div>
      </section>

      {/* Connected accounts */}
      {connected.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={t("bankNoConnections")}
          text={t("bankNoConnectionsText")}
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setConnectOpen(true)} type="button">
              <Plus size={15} />
              {t("connectBank")}
            </button>
          }
        />
      ) : (
        <div className="bank-list">
          {connected.map((connection) => (
            <div className="bank-card" key={connection.id}>
              <div className="bank-card-head">
                <div className="bank-institution-icon">
                  <Landmark size={17} />
                </div>
                <div className="bank-card-titles">
                  <div className="bank-card-name">{connection.institution_name}</div>
                  <div className="bank-card-meta">
                    <span className="status-dot connected" />
                    {t("bankStatusConnected")}
                    {connection.last_synced_at
                      ? ` · ${t("bankLastSynced", { time: timeAgo(connection.last_synced_at) })}`
                      : ` · ${t("bankNeverSynced")}`}
                  </div>
                </div>
                <DemoTag />
              </div>

              <div className="bank-account-list">
                {connection.accounts.map((account) => {
                  const busy = syncingId === account.id || simulatingId === account.id;
                  return (
                    <div className="bank-account-row" key={account.id}>
                      <div className="bank-account-info">
                        <div className="bank-account-name">
                          {account.account_name}
                          <span className="bank-account-type">
                            {t(`bankAccountType${account.account_type}`)}
                          </span>
                        </div>
                        <div className="bank-account-number">{account.account_number_masked}</div>
                      </div>
                      <div className="bank-account-balance">
                        <div className="bank-account-balance-label">{t("bankBalance")}</div>
                        <div className="bank-account-balance-value">
                          <MaskedAmount value={account.current_balance} />
                        </div>
                      </div>
                      <div className="bank-account-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleSync(account)}
                          disabled={busy}
                          type="button"
                        >
                          {syncingId === account.id ? (
                            <span className="spinner spinner-sm" />
                          ) : (
                            <RefreshCw size={13} />
                          )}
                          {t("bankSyncNow")}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleSimulate(account, "expense")}
                          disabled={busy}
                          type="button"
                        >
                          <ArrowDownToLine size={13} />
                          {t("bankSimulateExpense")}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleSimulate(account, "income")}
                          disabled={busy}
                          type="button"
                        >
                          <ArrowUpFromLine size={13} />
                          {t("bankSimulateIncome")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bank-card-foot">
                <button
                  className="link-btn danger"
                  onClick={() => setDisconnecting(connection)}
                  type="button"
                >
                  <Unplug size={13} />
                  {t("bankDisconnect")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConnectBankModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={() => load({ silent: true })}
      />

      <ConfirmDialog
        open={Boolean(disconnecting)}
        onClose={() => setDisconnecting(null)}
        onConfirm={confirmDisconnect}
        busy={disconnectBusy}
        title={t("bankDisconnectTitle", { name: disconnecting?.institution_name || "" })}
        confirmLabel={t("bankDisconnectConfirm")}
        message={t("bankDisconnectWarning", {
          name: disconnecting?.institution_name || "",
        })}
      />
    </>
  );
}
