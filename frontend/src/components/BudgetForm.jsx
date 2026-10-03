import { useState } from "react";
import { api } from "../api";
import { useToast } from "./Toast";
import { useUI } from "../context/UIContext";
import { todayISO } from "../utils/format";

const PERIODS = [
  { value: "daily", labelKey: "daily" },
  { value: "weekly", labelKey: "weekly" },
  { value: "monthly", labelKey: "monthly" },
  { value: "yearly", labelKey: "yearly" },
];

export default function BudgetForm({ initial, categories, onClose, onSaved }) {
  const { t } = useUI();
  const toast = useToast();
  const [form, setForm] = useState({
    categoryId: initial?.category_id ?? "",
    amount: initial?.amount ?? "",
    period: initial?.period || "monthly",
    startDate: initial?.start_date || todayISO(),
    endDate: initial?.end_date || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const amount = Number(form.amount);
    if (!form.categoryId) {
      setError(t("chooseCategoryForBudget"));
      return;
    }
    if (!amount || amount <= 0) {
      setError(t("enterAmountGreaterThanZero"));
      return;
    }
    if (!form.startDate) {
      setError(t("pickStartDate"));
      return;
    }
    const body = {
      categoryId: Number(form.categoryId),
      amount,
      period: form.period,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
    };
    setBusy(true);
    try {
      if (initial?.id) {
        await api.updateBudget(initial.id, body);
        toast.success(t("budgetUpdated"));
      } else {
        await api.createBudget(body);
        toast.success(t("budgetCreated"));
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="form-error">{error}</div>}

      <div className="field">
        <label htmlFor="bg-category">{t("category")}</label>
        <select
          id="bg-category"
          className="select"
          value={form.categoryId}
          onChange={set("categoryId")}
        >
          <option value="">{t("selectCategory")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="bg-amount">{t("budgetAmount")}</label>
          <input
            id="bg-amount"
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={set("amount")}
          />
        </div>
        <div className="field">
          <label htmlFor="bg-period">{t("period")}</label>
          <select id="bg-period" className="select" value={form.period} onChange={set("period")}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {t(p.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="bg-start">{t("startDate")}</label>
          <input
            id="bg-start"
            className="input"
            type="date"
            value={form.startDate}
            onChange={set("startDate")}
          />
        </div>
        <div className="field">
          <label htmlFor="bg-end">{t("endDateOptional")}</label>
          <input
            id="bg-end"
            className="input"
            type="date"
            value={form.endDate}
            onChange={set("endDate")}
          />
        </div>
      </div>

      <div className="modal-footer" style={{ padding: "18px 0 0", border: "none" }}>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          {t("cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? (
            <span className="spinner" style={{ borderColor: "rgba(255,255,255,.35)", borderTopColor: "#fff" }} />
          ) : initial?.id ? (
            t("saveChanges")
          ) : (
            t("createBudget")
          )}
        </button>
      </div>
    </form>
  );
}
