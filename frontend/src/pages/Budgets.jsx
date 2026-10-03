import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, PiggyBank, Tags, Info, Search } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { useUI } from "../context/UIContext";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import BudgetForm from "../components/BudgetForm";
import EmptyState from "../components/EmptyState";
import { CategoryIcon } from "../components/icons";
import { currency, formatDateShort } from "../utils/format";
import useLiveRefresh from "../hooks/useLiveRefresh";

const PERIOD_LABEL = { daily: "daily", weekly: "weekly", monthly: "monthly", yearly: "yearly" };

export default function Budgets() {
  const { t } = useUI();
  const toast = useToast();
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [details, setDetails] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query
        ? budgets.filter((b) =>
            (b.category_name || "").toLowerCase().includes(query),
          )
        : budgets,
    [budgets, query],
  );

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [bg, cats] = await Promise.all([api.getBudgets(), api.getCategories()]);
      setBudgets(bg);
      setCategories(cats);
    } catch (err) {
      if (!silent) toast.error(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: silently re-fetch so budget progress stays current.
  useLiveRefresh(() => load({ silent: true }), { interval: 30000 });

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteBudget(deleting.id);
      toast.success(t("budgetDeleted"));
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const catOf = (budget) => categories.find((c) => c.id === budget.category_id);

  const progress = (b) => {
    const spent = Number(b.spent);
    const amount = Number(b.amount);
    return { spent, amount, pct: amount > 0 ? Math.min((spent / amount) * 100, 100) : 0 };
  };

  const status = (b) => {
    const { spent, amount } = progress(b);
    if (amount > 0 && spent >= amount) return "over";
    if (amount > 0 && spent / amount >= 0.8) return "warn";
    return "ok";
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("budgets")}</h1>
          <p className="page-subtitle">
            {budgets.length} {budgets.length === 1 ? t("budget") : t("budgetsLabel")} — {t("budgetSubtitle")}
          </p>
        </div>
        <div className="page-header-tools">
          {budgets.length > 0 && (
            <div className="input-wrap">
              <Search size={15} className="input-icon" />
              <input
                className="input"
                type="search"
                placeholder={t("searchBudgets")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={t("searchBudgets")}
              />
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={categories.length === 0}
            title={categories.length === 0 ? t("createCategoryFirst") : ""}
          >
            <Plus size={17} />
            {t("createBudget")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel-skeleton">
          <div className="skeleton-block" style={{ height: 190 }} />
          <div className="skeleton-block" style={{ height: 190 }} />
          <div className="skeleton-block" style={{ height: 190 }} />
        </div>
      ) : budgets.length === 0 ? (
          categories.length === 0 ? (
            <EmptyState
              icon={Tags}
              title={t("createCategoriesFirst")}
              text={t("budgetsNeedCategories")}
              action={
                <button className="btn btn-ghost btn-sm" onClick={() => navigate("/categories")}>
                  {t("goToCategories")}
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={PiggyBank}
              title={t("noBudgetsYet")}
              text={t("budgetsHelpText")}
              action={
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus size={15} />
                  {t("addBudget")}
                </button>
              }
            />
          )
        ) : filtered.length === 0 ? (
          <div className="search-empty">{t("noMatches")}</div>
        ) : (
          <div className="budget-grid">
            {filtered.map((b) => {
              const cat = catOf(b);
              const { spent, amount, pct } = progress(b);
              const st = status(b);
              const pctDisplay = amount > 0 ? ((spent / amount) * 100).toFixed(1) : "0";
              const remaining = amount - spent;
              const fillColor =
                st === "over" ? "var(--expense)" : st === "warn" ? "var(--warning)" : "var(--income)";
              return (
                <div key={b.id} className="budget-card">
                  <div className="budget-top">
                    <div className="cat-card-icon" style={{ background: cat?.color || "#1f7a54" }}>
                      <CategoryIcon name={cat?.icon} size={19} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{b.category_name || t("unknown")}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                        {formatDateShort(b.start_date)}
                        {b.end_date ? ` → ${formatDateShort(b.end_date)}` : ""}
                      </div>
                    </div>
                    <span className="budget-period">
                      {PERIOD_LABEL[b.period] || b.period}
                    </span>
                  </div>

                  <div className="budget-amount">{currency(amount)}</div>

                  <div className="budget-progress-row">
                    <div
                      className="budget-progress-fill"
                      style={{ width: `${pct}%`, background: fillColor }}
                    />
                  </div>

                  <div className="budget-stats">
                    <span>
                      <strong>{currency(spent)}</strong> {t("spentAllTime")}
                    </span>
                    <span>
                      {st === "over" ? (
                        <span className="budget-status over">
                          {currency(-remaining)} {t("over")}
                        </span>
                      ) : (
                        <span>
                          <strong>{currency(remaining)}</strong> {t("left")}
                        </span>
                      )}
                    </span>
                    <span className={`budget-status ${st}`}>{pctDisplay}%</span>
                  </div>

                  <div className="budget-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => setDetails(b)}
                    >
                      <Info size={14} />
                      {t("details")}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setEditing(b);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil size={14} />
                      {t("edit")}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, color: "var(--danger)" }}
                      onClick={() => setDeleting(b)}
                    >
                      <Trash2 size={14} />
                      {t("delete")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("editBudget") : t("createBudget")}
      >
        <BudgetForm
          initial={editing}
          categories={categories}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      </Modal>

      <Modal
        open={Boolean(details)}
        onClose={() => setDetails(null)}
        title={t("budgetDetails")}
      >
        {details &&
          (() => {
            const cat = catOf(details);
            const { spent, amount, pct } = progress(details);
            const st = status(details);
            const pctDisplay = amount > 0 ? ((spent / amount) * 100).toFixed(1) : "0";
            const remaining = amount - spent;
            const fillColor =
              st === "over" ? "var(--expense)" : st === "warn" ? "var(--warning)" : "var(--income)";
            return (
              <>
                <div className="detail-head">
                  <div className="cat-card-icon" style={{ background: cat?.color || "#1f7a54" }}>
                    <CategoryIcon name={cat?.icon} size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="detail-name">{details.category_name || t("unknown")}</div>
                    <div className="detail-meta">
                      {formatDateShort(details.start_date)}
                      {details.end_date ? ` → ${formatDateShort(details.end_date)}` : ""}
                    </div>
                  </div>
                  <span className="budget-period">
                    {PERIOD_LABEL[details.period] || details.period}
                  </span>
                </div>

                <div className="detail-rows">
                  <div className="detail-row">
                    <span>{t("budgetAmount")}</span>
                    <strong>{currency(amount)}</strong>
                  </div>
                  <div className="detail-row">
                    <span>{t("spentAllTime")}</span>
                    <strong>{currency(spent)}</strong>
                  </div>
                  <div className="detail-row">
                    <span>{st === "over" ? t("over") : t("left")}</span>
                    <strong
                      style={{ color: st === "over" ? "var(--expense)" : undefined }}
                    >
                      {currency(st === "over" ? -remaining : remaining)}
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>{t("used")}</span>
                    <strong>{pctDisplay}%</strong>
                  </div>
                </div>

                <div className="budget-progress-row detail-progress">
                  <div
                    className="budget-progress-fill"
                    style={{ width: `${pct}%`, background: fillColor }}
                  />
                </div>
              </>
            );
          })()}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
        title={t("deleteBudget")}
        confirmLabel={t("delete")}
        message={t("deleteBudgetWarning", {
          period: t(PERIOD_LABEL[deleting?.period] || "budget"),
          name: deleting?.category_name || t("thisCategory"),
        })}
      />
    </>
  );
}
