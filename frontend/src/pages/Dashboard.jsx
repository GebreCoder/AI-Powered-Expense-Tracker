import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  ArrowLeftRight,
  ChartLine,
  RefreshCw,
  Search,
  Landmark,
} from "lucide-react";
import { useUI } from "../context/UIContext";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import InsightCard from "../components/InsightCard";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import CategoryBreakdown from "../components/CategoryBreakdown";
import { CategoryIcon, colorFor } from "../components/icons";
import {
  currency,
  currencyCompact,
  formatDateShort,
  todayISO,
} from "../utils/format";
import useLiveRefresh from "../hooks/useLiveRefresh";
import LiveBadge from "../components/LiveBadge";
import MaskedAmount from "../components/MaskedAmount";
import { DATA_CHANGED_EVENT } from "../hooks/useBankEvents";

function budgetStatus(b) {
  const spent = Number(b.spent);
  const amount = Number(b.amount);
  if (amount > 0 && spent >= amount) return "over";
  if (amount > 0 && spent / amount >= 0.8) return "warn";
  return "ok";
}

function statusColor(status) {
  if (status === "over") return "var(--expense)";
  if (status === "warn") return "var(--warning)";
  return "var(--income)";
}

function SectionHeader({ title, hint, action }) {
  return (
    <div className="dash-section-head">
      <div className="dash-section-titles">
        <h2 className="dash-section-title">{title}</h2>
        {hint && <p className="dash-section-hint">{hint}</p>}
      </div>
      {action && <div className="dash-section-action">{action}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useUI();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recent, setRecent] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [q, setQ] = useState("");
  const [bankConnections, setBankConnections] = useState([]);
  const [bankConfig, setBankConfig] = useState(null);
  const signatureRef = useRef("");
  const insightsRequestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api.dashboard.summary(),
      api.dashboard.monthlyTrend(),
      api.dashboard.categoryBreakdown(),
      api.getCategories(),
      api.getTransactions(),
      api.getBudgets(),
    ]).then(([s, t, b, c, tx, bg]) => {
      if (cancelled) return;
      if (s.status === "fulfilled") setSummary(s.value);
      if (t.status === "fulfilled") setTrend(t.value);
      if (b.status === "fulfilled") setBreakdown(b.value);
      if (c.status === "fulfilled") setCategories(c.value);
      if (tx.status === "fulfilled") setRecent(tx.value.slice(0, 7));
      if (bg.status === "fulfilled") setBudgets(bg.value);
      signatureRef.current = JSON.stringify([
        s.status === "fulfilled" ? s.value : null,
        tx.status === "fulfilled" ? tx.value : null,
      ]);
      const failed = [s, t, b, c, tx, bg].some((r) => r.status === "rejected");
      if (failed) toast.error(t("someDashboardDataFailed"));
    }).finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // Bank connections load independently so a disabled/unavailable bank
  // feature never trips the "some dashboard data failed" toast.
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.bank.connections(), api.bank.config()]).then(
      ([conns, cfg]) => {
        if (cancelled) return;
        if (conns.status === "fulfilled") setBankConnections(conns.value);
        if (cfg.status === "fulfilled") setBankConfig(cfg.value);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const loadInsights = useCallback(async (refresh = false, silent = false) => {
    // Always request the browser-local "today" so the dashboard matches the
    // day the user sees in the rest of the UI (server UTC can differ near midnight).
    const id = ++insightsRequestId.current;
    if (refresh) setRegenerating(true);
    else if (!silent) setInsightsLoading(true);
    setInsightsError(null);
    try {
      const params = { date: todayISO() };
      if (refresh) params.refresh = "1";
      const data = await api.insights.get(params);
      if (id !== insightsRequestId.current) return false;
      setInsights(data);
      return true;
    } catch (err) {
      if (id !== insightsRequestId.current) return false;
      setInsightsError(err.message);
      return false;
    } finally {
      if (id === insightsRequestId.current) {
        setInsightsLoading(false);
        setRegenerating(false);
      }
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const handleRegenerate = async () => {
    const ok = await loadInsights(true);
    if (ok) toast.success(t("insightsRefreshed"));
  };

  // Real-time: poll the dashboard data every 30s. Insights are cached and
  // rate-limited server-side, so they only re-fetch when the data changed.
  const refreshLive = useCallback(async () => {
    const [s, t, b, c, tx, bg] = await Promise.allSettled([
      api.dashboard.summary(),
      api.dashboard.monthlyTrend(),
      api.dashboard.categoryBreakdown(),
      api.getCategories(),
      api.getTransactions(),
      api.getBudgets(),
    ]);
    if (s.status === "fulfilled") setSummary(s.value);
    if (t.status === "fulfilled") setTrend(t.value);
    if (b.status === "fulfilled") setBreakdown(b.value);
    if (c.status === "fulfilled") setCategories(c.value);
    if (tx.status === "fulfilled") setRecent(tx.value.slice(0, 7));
    if (bg.status === "fulfilled") setBudgets(bg.value);
    const signature = JSON.stringify([
      s.status === "fulfilled" ? s.value : null,
      tx.status === "fulfilled" ? tx.value : null,
    ]);
    if (signature !== signatureRef.current) {
      signatureRef.current = signature;
      loadInsights(false, true); // silent — don't flash the loading skeleton
    }
    Promise.allSettled([api.bank.connections(), api.bank.config()]).then(
      ([conns, cfg]) => {
        if (conns.status === "fulfilled") setBankConnections(conns.value);
        if (cfg.status === "fulfilled") setBankConfig(cfg.value);
      },
    );
  }, [loadInsights]);

  const { lastUpdated } = useLiveRefresh(refreshLive, { interval: 30000 });

  // Real-time: new bank transactions trigger an instant silent refresh.
  useEffect(() => {
    const handler = () => refreshLive();
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
  }, [refreshLive]);

  const colorMap = useMemo(() => {
    const map = {};
    categories.forEach((c, i) => {
      map[c.name] = c.color || colorFor(c.name, i);
    });
    return map;
  }, [categories]);

  const breakdownWithColors = useMemo(
    () =>
      breakdown.map((b, i) => ({
        ...b,
        fill: colorMap[b.category_name] || colorFor(b.category_name, i),
      })),
    [breakdown, colorMap],
  );

  // Month-over-month context from the real trend data.
  const monthContext = useMemo(() => {
    const latest = trend[trend.length - 1];
    const prev = trend[trend.length - 2];
    const thisMonthIncome = latest ? Number(latest.income) : 0;
    const thisMonthExpense = latest ? Number(latest.expense) : 0;
    const thisMonthNet = thisMonthIncome - thisMonthExpense;
    const prevIncome = prev ? Number(prev.income) : null;
    const prevExpense = prev ? Number(prev.expense) : null;
    const prevNet = prevIncome != null ? prevIncome - prevExpense : null;
    return {
      thisMonthIncome,
      thisMonthExpense,
      thisMonthNet,
      netDelta: prevNet == null ? null : thisMonthNet - prevNet,
      incomeDelta: prevIncome == null ? null : thisMonthIncome - prevIncome,
      expenseDelta: prevExpense == null ? null : thisMonthExpense - prevExpense,
    };
  }, [trend]);

  const budgetRows = useMemo(
    () =>
      budgets
        .map((b) => {
          const spent = Number(b.spent);
          const amount = Number(b.amount);
          const pct = amount > 0 ? Math.min((spent / amount) * 100, 100) : 0;
          const status = budgetStatus(b);
          const remaining = amount - spent;
          return { ...b, spent, amount, pct, status, remaining };
        })
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 4),
    [budgets],
  );
  const anyAtRisk = budgetRows.some((b) => b.status !== "ok");

  const connectedAccounts = useMemo(
    () =>
      bankConnections
        .filter((c) => c.status === "connected")
        .flatMap((c) => c.accounts || []),
    [bankConnections],
  );

  // Page search — filters the recent transactions and budgets on this page.
  const query = q.trim().toLowerCase();
  const filteredRecent = useMemo(() => {
    if (!query) return recent;
    return recent.filter(
      (tx) =>
        (tx.description || "").toLowerCase().includes(query) ||
        (tx.category_name || "").toLowerCase().includes(query) ||
        tx.type.toLowerCase().includes(query),
    );
  }, [recent, query]);

  const filteredBudgetRows = useMemo(() => {
    if (!query) return budgetRows;
    return budgetRows.filter((b) =>
      (b.category_name || "").toLowerCase().includes(query),
    );
  }, [budgetRows, query]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("goodMorning") : hour < 18 ? t("goodAfternoon") : t("goodEvening");
  const firstName = (user?.full_name || t("there")).split(" ")[0];
  const vsLabel = t("vsLastMonth");

  if (loading) {
    return (
      <>
        <div className="skeleton-stats">
          <div className="skeleton-block" />
          <div className="skeleton-block" />
          <div className="skeleton-block" />
        </div>
        <div className="skeleton-block" style={{ height: 240 }} />
      </>
    );
  }

  return (
    <div className="dash">
      <div className="page-header dash-header">
        <div>
          <h1 className="page-title">
            {greeting}, <span className="gradient-text">{firstName}</span>
          </h1>
          <p className="page-subtitle">{t("dashboardSubtitle")}</p>
        </div>
        <div className="dash-header-right">
          <div className="search-field-row">
            <div className="input-wrap">
              <Search size={15} className="input-icon" />
              <input
                className="input"
                type="search"
                placeholder={t("searchDashboard")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={t("searchDashboard")}
              />
            </div>
          </div>
          <LiveBadge lastUpdated={lastUpdated} />
        </div>
      </div>

      <div className="stat-panel">
        <StatCard
          label={t("netBalance")}
          value={currency(summary?.net_balance)}
          sub={t("incomeMinusExpenses")}
          tone="primary"
          delta={monthContext.netDelta}
          deltaLabel={vsLabel}
        />
        <StatCard
          label={t("totalIncome")}
          value={currency(summary?.total_income)}
          sub={`${currencyCompact(monthContext.thisMonthIncome)} ${t("thisMonth")}`}
          tone="income"
          delta={monthContext.incomeDelta}
          deltaLabel={vsLabel}
        />
        <StatCard
          label={t("totalExpenses")}
          value={currency(summary?.total_expense)}
          sub={`${currencyCompact(monthContext.thisMonthExpense)} ${t("thisMonth")}`}
          tone="expense"
          delta={monthContext.expenseDelta}
          deltaInvert
          deltaLabel={vsLabel}
        />
      </div>

      {/* Connected demo bank accounts */}
      {bankConfig?.enabled && (
        <section className="dash-section bank-dash">
          {connectedAccounts.length > 0 ? (
            <div className="bank-dash-panel">
              <div className="bank-dash-main">
                <div className="bank-dash-head">
                  <div>
                    <div className="panel-title">{t("bankDashboardConnected")}</div>
                    <div className="panel-hint">{t("bankDashboardHint")}</div>
                  </div>
                  <button
                    className="link-btn"
                    onClick={() => navigate("/bank")}
                    type="button"
                  >
                    {t("bankManage")}
                  </button>
                </div>
                <div className="bank-dash-accounts">
                  {connectedAccounts.slice(0, 3).map((account) => (
                    <div className="bank-dash-account" key={account.id}>
                      <Landmark size={15} />
                      <div className="bank-dash-account-info">
                        <div className="bank-dash-account-name">
                          {account.account_name}
                        </div>
                        <div className="bank-dash-account-number">
                          {account.account_number_masked}
                        </div>
                      </div>
                      <div className="bank-dash-account-balance">
                        <MaskedAmount value={account.current_balance} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {bankConfig?.simulationEnabled && (
                <div className="bank-dash-live">
                  <span className="live-dot on" />
                  {t("bankLiveSimulation")}
                </div>
              )}
            </div>
          ) : (
            <div className="bank-dash-cta">
              <div>
                <div className="bank-dash-cta-title">{t("bankDashboardConnect")}</div>
                <div className="bank-dash-cta-text">{t("bankNoConnectionsText")}</div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate("/bank")}
                type="button"
              >
                {t("connectBank")}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Daily summary */}
      <section className="dash-section">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">{t("dailySummary")}</div>
              <div className="panel-hint">
                {insights?.date
                  ? t("yourFinancialSummary")
                  : t("personalizedInsights")}
              </div>
            </div>
            <div className="panel-actions">
              {insights?.source === "ai" && (
                <span className="source-badge ai">{t("aiGenerated")}</span>
              )}
              {insights?.source === "rules" && (
                <span className="source-badge rules">{t("smartSummary")}</span>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleRegenerate}
                disabled={regenerating || insightsLoading}
                type="button"
              >
                {regenerating ? (
                  <span className="spinner spinner-sm" />
                ) : (
                  <RefreshCw size={13} />
                )}
                {regenerating ? t("analyzing") : t("regenerate")}
              </button>
            </div>
          </div>

        {insightsLoading ? (
          <div className="insights-loading">
            <div className="insights-thinking">
              <span className="spinner spinner-sm" />
              {t("analyzing")}
            </div>
            <div className="insights-skeleton">
              <div className="skeleton-block" style={{ height: 64 }} />
              <div className="skeleton-block" style={{ height: 64 }} />
            </div>
          </div>
        ) : insightsError ? (
          <div className="insights-error">
            <div style={{ minWidth: 0 }}>
              <div className="insights-error-title">{t("couldntLoadInsights")}</div>
              <div className="insights-error-text">{insightsError}</div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => loadInsights(false)}
              type="button"
            >
              <RefreshCw size={13} />
              {t("tryAgain")}
            </button>
          </div>
        ) : !insights || insights.insights.length === 0 ? (
          <EmptyState
            icon={ChartLine}
            title={t("insightsOnTheWay")}
            text={t("addFewTransactionsSummary")}
          />
        ) : (
          <div className="insight-list">
            {insights.insights.map((insight, i) => (
              <InsightCard
                key={`${insight.title}-${i}`}
                insight={insight}
                index={i}
                featured={i === 0}
              />
            ))}
          </div>
        )}
        </div>
      </section>

      {/* Analytics */}
      <section className="dash-section">
        <SectionHeader
          title={t("analytics")}
          hint={t("analyticsHint")}
        />
        <div className="analytics-panel">
          <MonthlyTrendChart trend={trend} compact />
          <div className="analytics-divider" />
          <CategoryBreakdown
            items={breakdownWithColors}
            totalSpent={breakdown.reduce(
              (sum, b) => sum + Number(b.total_spent),
              0,
            )}
          />
        </div>
      </section>

      {/* Recent activity */}
      <section className="dash-section">
        <div className="activity-grid">
          <div className="panel activity-panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">{t("recentTransactions")}</div>
                <div className="panel-hint">{t("yourLatestActivity")}</div>
              </div>
              <button
                className="link-btn"
                onClick={() => navigate("/transactions")}
                type="button"
              >
                {t("viewAll")}
              </button>
            </div>
            {recent.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title={t("noTransactionsYet")}
                text={t("recordFirstTransaction")}
                action={
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate("/transactions?new=1")}
                    type="button"
                  >
                    <Plus size={15} />
                    {t("addTransaction")}
                  </button>
                }
              />
            ) : filteredRecent.length === 0 ? (
              <div className="search-empty">{t("noMatches")}</div>
            ) : (
              <div className="table-wrap dash-table">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("date")}</th>
                      <th>{t("description")}</th>
                      <th>{t("category")}</th>
                      <th style={{ textAlign: "right" }}>{t("amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecent.map((tx) => (
                      <tr key={tx.id}>
                        <td className="cell-date">
                          {formatDateShort(tx.transaction_date)}
                        </td>
                        <td className={`cell-desc ${tx.description ? "" : "no-cat"}`}>
                          {tx.description || t("untitled")}
                        </td>
                        <td>
                          {tx.category_name ? (
                            <span className="dash-cat">
                              <span
                                className="dot"
                                style={{
                                  background:
                                    colorMap[tx.category_name] || "#64748b",
                                }}
                              />
                              {tx.category_name}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            className={
                              tx.type === "income"
                                ? "amount-income"
                                : "amount-expense"
                            }
                          >
                            {tx.type === "income" ? "+" : "−"}
                            {currency(tx.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel activity-panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">{t("budgets")}</div>
                <div className="panel-hint">{t("budgetLimitsPrompt")}</div>
              </div>
              <button
                className="link-btn"
                onClick={() => navigate("/budgets")}
                type="button"
              >
                {t("viewAll")}
              </button>
            </div>
            {budgetRows.length === 0 ? (
              <div className="budget-mini-empty">
                <p>{t("budgetLimitsPrompt")}</p>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate("/budgets")}
                  type="button"
                >
                  {t("setBudgets")}
                </button>
              </div>
            ) : filteredBudgetRows.length === 0 ? (
              <div className="search-empty">{t("noMatches")}</div>
            ) : (
              <div className="budget-mini">
                {filteredBudgetRows.map((b) => {
                  const cat = categories.find((c) => c.id === b.category_id);
                  const pctDisplay =
                    b.amount > 0 ? ((b.spent / b.amount) * 100).toFixed(0) : "0";
                  return (
                    <div className="budget-mini-row" key={b.id}>
                      <div className="budget-mini-head">
                        <span className="dash-cat">
                          <span
                            className="dot"
                            style={{
                              background:
                                cat?.color ||
                                colorMap[b.category_name] ||
                                "#64748b",
                            }}
                          />
                          {b.category_name}
                        </span>
                        <span className={`budget-mini-status ${b.status}`}>
                          {b.status === "over"
                            ? `${currency(-b.remaining)} ${t("over")}`
                            : `${currency(b.remaining)} ${t("left")}`}
                        </span>
                      </div>
                      <div className="budget-mini-track">
                        <div
                          className="budget-mini-fill"
                          style={{
                            width: `${b.pct}%`,
                            background: statusColor(b.status),
                          }}
                        />
                      </div>
                      <div className="budget-mini-meta">
                        {t("budgetUsage", {
                          spent: currencyCompact(b.spent),
                          amount: currencyCompact(b.amount),
                        })}
                        <span className="budget-mini-pct">{pctDisplay}%</span>
                      </div>
                    </div>
                  );
                })}
                {!anyAtRisk && (
                  <div className="budget-mini-foot">
                    <span className="budget-status ok">{t("allBudgetsOnTrack")}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
