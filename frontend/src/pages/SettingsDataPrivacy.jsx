import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Trash2, FileText, Printer } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { currency } from "../utils/format";

export default function SettingsDataPrivacy() {
  const { t } = useUI();
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // ---- Export data ----
  const [exporting, setExporting] = useState(false);
  const [rows, setRows] = useState([]);
  const [rowsLoaded, setRowsLoaded] = useState(false);

  const loadRows = async () => {
    if (!rowsLoaded) {
      const data = await api.getTransactions();
      setRows(data);
      setRowsLoaded(true);
      return data;
    }
    return rows;
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await loadRows();
      const escape = (v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ["date", "description", "category", "type", "amount"]
        .map((k) => escape(t(k)))
        .join(",");
      const lines = data.map((tx) =>
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
      a.download = `spendwise-data-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("dataExported"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  // Export data as PDF
  const exportPdf = async () => {
    setExporting(true);
    try {
      const data = await loadRows();
      if (data.length === 0) {
        toast.error(t("noTransactionsToExport"));
        setExporting(false);
        return;
      }
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(t("transactions"), 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`${t("exportedOn")} ${new Date().toLocaleDateString()}`, 14, 30);
      const totalIncome = data
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const totalExpense = data
        .filter((tx) => tx.type === "expense")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(`${t("totalIncome")}: ${currency(totalIncome)}`, 14, 38);
      doc.text(`${t("totalExpenses")}: ${currency(totalExpense)}`, 14, 44);
      doc.text(`${t("netBalance")}: ${currency(totalIncome - totalExpense)}`, 14, 50);
      const tableData = data.map((tx) => [
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
      doc.save(`spendwise-data-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(t("exportPdfSuccess"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  // Print all transactions via browser print dialog
  const printTransactions = async () => {
    setExporting(true);
    try {
      const data = await loadRows();
      if (data.length === 0) {
        toast.error(t("noTransactionsToExport"));
        setExporting(false);
        return;
      }
      const totalIncome = data
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const totalExpense = data
        .filter((tx) => tx.type === "expense")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const rows = data
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
  <div class="meta">${t("exportedOn")} ${new Date().toLocaleDateString()} — ${data.length} ${data.length === 1 ? t("record") : t("records")}</div>
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
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  // ---- Delete account ----
  const [delPassword, setDelPassword] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState("");
  const canDelete = delConfirm.trim() === "DELETE" && delPassword.length > 0;

  const deleteAccount = async (e) => {
    e.preventDefault();
    setDelBusy(true);
    setDelError("");
    try {
      await api.deleteAccount({ currentPassword: delPassword });
      toast.success(t("accountDeleted"));
      logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setDelError(err.message || t("deleteAccountError"));
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("dataAndPrivacy")}</h1>
          <p className="page-subtitle">{t("dataAndPrivacyHint")}</p>
        </div>
      </div>

      <div className="settings-stack">
        <div className="card settings-page-card">
          <div className="settings-body">
            <div className="settings-row">
              <div>
                <div className="settings-row-label">{t("exportData")}</div>
                <div className="settings-row-hint">{t("exportDataHint")}</div>
              </div>
              <div className="export-buttons">
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={exportData}
                  disabled={exporting}
                >
                  {exporting ? <span className="spinner spinner-sm" /> : <Download size={14} />}
                  CSV
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={exportPdf}
                  disabled={exporting}
                >
                  {exporting ? <span className="spinner spinner-sm" /> : <FileText size={14} />}
                  PDF
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={printTransactions}
                  disabled={exporting}
                >
                  {exporting ? <span className="spinner spinner-sm" /> : <Printer size={14} />}
                  {t("print")}
                </button>
              </div>
            </div>

            <div className="settings-divider" />

            <div className="settings-danger">
              <div className="settings-danger-head">
                <Trash2 size={16} />
                <div>
                  <div className="settings-danger-title">{t("deleteAccount")}</div>
                  <div className="settings-danger-hint">{t("deleteAccountHint")}</div>
                </div>
              </div>

              <form className="settings-form" onSubmit={deleteAccount}>
                <div className="field">
                  <label htmlFor="del-password">{t("currentPassword")}</label>
                  <input
                    id="del-password"
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    value={delPassword}
                    onChange={(e) => setDelPassword(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="del-confirm">{t("typeDeleteToConfirm")}</label>
                  <input
                    id="del-confirm"
                    className="input"
                    value={delConfirm}
                    onChange={(e) => setDelConfirm(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>

                {delError && <div className="form-error">{delError}</div>}

                <div className="settings-form-actions">
                  <button
                    className="btn btn-danger"
                    type="submit"
                    disabled={!canDelete || delBusy}
                  >
                    {delBusy ? <span className="spinner spinner-sm" /> : <Trash2 size={14} />}
                    {t("deleteAccount")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
