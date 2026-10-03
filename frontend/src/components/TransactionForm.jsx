import { useState } from "react";
import { api } from "../api";
import { useToast } from "./Toast";
import { useUI } from "../context/UIContext";
import { todayISO } from "../utils/format";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export default function TransactionForm({ initial, categories, onClose, onSaved }) {
  const { t } = useUI();
  const toast = useToast();
  const [form, setForm] = useState({
    type: initial?.type || "expense",
    amount: initial?.amount ?? "",
    categoryId: initial?.category_id ?? "",
    transactionDate: initial?.transaction_date || todayISO(),
    description: initial?.description || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError(t("enterAmountGreaterThanZero"));
      return;
    }
    if (!form.transactionDate) {
      setError(t("pickTransactionDate"));
      return;
    }
    const body = {
      type: form.type,
      amount,
      transactionDate: form.transactionDate,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      description: form.description.trim() || undefined,
    };
    setBusy(true);
    try {
      if (initial?.id) {
        await api.updateTransaction(initial.id, body);
        toast.success(t("transactionUpdated"));
      } else {
        await api.createTransaction(body);
        toast.success(t("transactionAdded"));
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
        <label>{t("type")}</label>
        <div className="segmented">
          <button
            type="button"
            className={form.type === "expense" ? "active-expense" : ""}
            onClick={() => setForm((f) => ({ ...f, type: "expense" }))}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ArrowDownCircle size={15} /> {t("expenseLabel")}
            </span>
          </button>
          <button
            type="button"
            className={form.type === "income" ? "active-income" : ""}
            onClick={() => setForm((f) => ({ ...f, type: "income" }))}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ArrowUpCircle size={15} /> {t("incomeLabel")}
            </span>
          </button>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="tx-amount">{t("amount")}</label>
          <input
            id="tx-amount"
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
          <label htmlFor="tx-date">{t("date")}</label>
          <input
            id="tx-date"
            className="input"
            type="date"
            value={form.transactionDate}
            onChange={set("transactionDate")}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="tx-category">{t("category")}</label>
        <select
          id="tx-category"
          className="select"
          value={form.categoryId}
          onChange={set("categoryId")}
        >
          <option value="">{t("noCategory")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="tx-desc">{t("description")}</label>
        <input
          id="tx-desc"
          className="input"
          type="text"
          placeholder={t("exampleDescription")}
          value={form.description}
          onChange={set("description")}
        />
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
            t("addTransaction")
          )}
        </button>
      </div>
    </form>
  );
}
