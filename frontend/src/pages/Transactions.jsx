import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeftRight,
  X,
  Search,
  AlertTriangle,
  RefreshCw,
  Download,
  FileText,
  Printer,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../api";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import TransactionForm from "../components/TransactionForm";
import EmptyState from "../components/EmptyState";
import { CategoryIcon } from "../components/icons";
import { currency, formatDate, todayISO } from "../utils/format";
import { useUI } from "../context/UIContext";
import useLiveRefresh from "../hooks/useLiveRefresh";
import { DATA_CHANGED_EVENT } from "../hooks/useBankEvents";

export default function Transactions() {
  const { t } = useUI();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: "", categoryId: "", startDate: "", endDate: "" });
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setLoadError("");
    }
    try {
      const [tx, cats] = await Promise.all([
        api.getTransactions(filters),
        api.getCategories(),
      ]);
      setTransactions(tx);
      setCategories(cats);
    } catch (err) {
      if (!silent) setLoadError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: silently re-fetch so new activity shows up without a reload.
  useLiveRefresh(() => load({ silent: true }), { interval: 30000 });

  // Real-time (push): new bank transactions trigger an instant silent refresh.
  useEffect(() => {
    const handler = () => load({ silent: true });
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
  }, [load]);

  // Support /transactions?new=1 (deep link from the dashboard).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") === "1") {
      setFormOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const hasFilters = Object.values(filters).some((v) => v !== "");
  const filtered = search.trim()
    ? transactions.filter((t) =>
        (t.description || "").toLowerCase().includes(search.trim().toLowerCase()),
      )
    : transactions;

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (tx) => {
    setEditing(tx);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteTransaction(deleting.id);
      toast.success(t("transactionDeleted"));
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const colorOf = (name) =>
    categories.find((c) => c.name === name)?.color || "#64748b";

  // Export the current (filtered + searched) rows as a CSV file.
  const exportCsv = () => {
    if (filtered.length === 0) return;
    const escape = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["date", "description", "category", "type", "amount"]
      .map((k) => escape(t(k)))
      .join(",");
    const lines = filtered.map((tx) =>
      [
        tx.transaction_date || "",
        tx.description || "",
        tx.category_name || "",
        tx.type,
        Number(tx.amount || 0).toFixed(2),
      ]
        .map(escape)
        .join(","),
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spendwise-transactions-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export the current (filtered + searched) rows as a PDF file.
  const exportPdf = () => {
    if (filtered.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(t("transactions"), 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${t("exportedOn")} ${new Date().toLocaleDateString()}`, 14, 30);
    const totalIncome = filtered
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const totalExpense = filtered
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`${t("totalIncome")}: ${currency(totalIncome)}`, 14, 38);
    doc.text(`${t("totalExpenses")}: ${currency(totalExpense)}`, 14, 44);
    doc.text(`${t("netBalance")}: ${currency(totalIncome - totalExpense)}`, 14, 50);
    const tableData = filtered.map((tx) => [
      tx.transaction_date || "",
      tx.description || t("untitled"),
      tx.category_name || "—",
      tx.type === "income" ? t("income") : t("expenses"),
      `${tx.type === "income" ? "+" : "−"}${currency(tx.amount)}`,
    ]);
    autoTable(doc, {
      startY: 56,
      head: [[t("date"), t("description"), t("category"), t("type"), t("amount")]],
      body: tableData,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    doc.save(`spendwise-transactions-${todayISO()}.pdf`);
    toast.success(t("exportPdfSuccess"));
  };

  // Print the current (filtered + searched) rows via browser print dialog.
  const printTransactions = () => {
    if (filtered.length === 0) return;
    const totalIncome = filtered
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const totalExpense = filtered
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const rows = filtered
      .map(
        (tx) => `<tr>
          <td>${tx.transaction_date || ""}</td>
          <td>${tx.description || t("untitled")}</td>
          <td>${tx.category_name || "—"}</td>
          <td>${tx.type === "income" ? t("income") : t("expenses")}</td>
          <td class="${tx.type === "income" ? "inc" : "exp"}">${tx.type === "income" ? "+" : "−"}${currency(tx.amount)}</td>
        </tr>`,
      )
      .join("");
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${t("transactions")}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #1e293b; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 18px; }
  .summary { display: flex; gap: 24px; margin-bottom: 18px; font-size: 13px; }
  .summary span { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #4f46e5; color: #fff; text-align: left; padding: 8px 10px; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }
  .inc { color: #059669; font-weight: 600; }
  .exp { color: #dc2626; font-weight: 600; }
  @media print { body { padding: 16px; } }
</style></head><body>
  <h1>${t("transactions")}</h1>
  <div class="meta">${t("exportedOn")} ${new Date().toLocaleDateString()} — ${filtered.length} ${filtered.length === 1 ? t("record") : t("records")}</div>
  <div class="summary">
    <div>${t("totalIncome")}: <span class="inc">${currency(totalIncome)}</span></div>
    <div>${t("totalExpenses")}: <span class="exp">${currency(totalExpense)}</span></div>
    <div>${t("netBalance")}: <span>${currency(totalIncome - totalExpense)}</span></div>
  </div>
  <table><thead><tr>
    <th>${t("date")}</th><th>${t("description")}</th><th>${t("category")}</th><th>${t("type")}</th><th>${t("amount")}</th>
  </tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
    const win = window.open("", "_blank", "width=800,height=600");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("transactions")}</h1>
          <p className="page-subtitle">
            {transactions.length} {transactions.length === 1 ? t("record") : t("records")}
            {hasFilters ? ` (${t("filtered")})` : ""}
          </p>
        </div>
        <div className="page-header-actions">
          <div className="export-dropdown">
            <button
              className="btn btn-ghost"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              type="button"
              title={t("exportCsv")}
            >
              <Download size={16} />
              CSV
            </button>
            <button
              className="btn btn-ghost"
              onClick={exportPdf}
              disabled={filtered.length === 0}
              type="button"
              title={t("exportPdf")}
            >
              <FileText size={16} />
              PDF
            </button>
            <button
              className="btn btn-ghost"
              onClick={printTransactions}
              disabled={filtered.length === 0}
              type="button"
              title={t("print")}
            >
              <Printer size={16} />
              {t("print")}
            </button>
          </div>
          <button className="btn btn-primary" onClick={openAdd} type="button">
            <Plus size={17} />
            {t("addTransaction")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filters">
          <div className="input-wrap" style={{ minWidth: 220 }}>
            <Search size={15} className="input-icon" />
            <input
              className="input"
              type="text"
              placeholder={t("searchDescriptions")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select
            className="select"
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            aria-label={t("filterByType")}
          >
            <option value="">{t("allTypes")}</option>
            <option value="expense">{t("expenses")}</option>
            <option value="income">{t("income")}</option>
          </select>
          <select
            className="select"
            value={filters.categoryId}
            onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
            aria-label={t("filterByCategory")}
          >
            <option value="">{t("allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className="input filter-date"
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
            aria-label={t("fromDate")} 
          />
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("to")}</span>
          <input
            className="input filter-date"
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
            aria-label={t("toDate")}
          />
          {(hasFilters || search) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFilters({ type: "", categoryId: "", startDate: "", endDate: "" });
                setSearch("");
              }}
            >
              <X size={14} />
              {t("clear")}
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 22 }}>
            <div className="skeleton-block" style={{ height: 240 }} />
          </div>
        ) : loadError ? (
          <EmptyState
            icon={AlertTriangle}
            title={t("couldntLoadTransactions")}
            text={
              <>
                <span>{t("transactionsErrorHint")}</span>
                {loadError && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 6,
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                    }}
                  >
                    {loadError}
                  </span>
                )}
              </>
            }
            action={
              <button className="btn btn-primary btn-sm" onClick={load} type="button">
                <RefreshCw size={15} />
                {t("tryAgain")}
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title={hasFilters || search ? t("noMatchingTransactions") : t("noTransactionsYet")}
            text={
              hasFilters || search
                ? t("tryAdjustingFilters")
                : t("recordFirstTransaction")
            }
            action={
              !hasFilters && !search ? (
                <button className="btn btn-primary btn-sm" onClick={openAdd} type="button">
                  <Plus size={15} />
                  {t("addTransaction")}
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("date")}</th>
                  <th>{t("description")}</th>
                  <th>{t("category")}</th>
                  <th>{t("type")}</th>
                  <th style={{ textAlign: "right" }}>{t("amount")}</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id}>
                    <td className="cell-date">{formatDate(tx.transaction_date)}</td>
                    <td>
                      <div className="cell-desc-wrap">
                        <span className={`cell-desc ${tx.description ? "" : "no-cat"}`}>
                          {tx.description || t("untitled")}
                        </span>
                        {tx.source === "bank" && (
                          <span className="bank-source-tag">{t("bankSource")}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {tx.category_name ? (
                        <span className="cat-chip">
                          <span className="dot" style={{ background: colorOf(tx.category_name) }}>
                            <CategoryIcon
                              name={categories.find((c) => c.name === tx.category_name)?.icon}
                              size={10}
                            />
                          </span>
                          {tx.category_name}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`type-badge ${tx.type}`}>
                        {tx.type === "income" ? t("income") : t("expenses")}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className={tx.type === "income" ? "amount-income" : "amount-expense"}>
                        {tx.type === "income" ? "+" : "−"}
                        {currency(tx.amount)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-btn in-card"
                          onClick={() => openEdit(tx)}
                          aria-label={t("editTransaction")}
                          type="button"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-btn in-card danger"
                          onClick={() => setDeleting(tx)}
                          aria-label={t("deleteTransaction")}
                          type="button"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("editTransaction") : t("addTransaction")}
      >
        <TransactionForm
          initial={editing}
          categories={categories}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
        title={t("deleteTransaction")}
        confirmLabel={t("delete")}
        message={t("deleteTransactionWarning", {
          name: deleting?.description || t("untitledTransaction"),
          amount: deleting ? currency(deleting.amount) : "",
        })}
      />
    </>
  );
}
