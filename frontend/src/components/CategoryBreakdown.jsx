import { ReceiptText } from "lucide-react";
import { useUI } from "../context/UIContext";
import { currencyCompact } from "../utils/format";

/**
 * Compact spending distribution: category → amount → percentage.
 * Replaces the donut so the data is scannable at a glance.
 */
export default function CategoryBreakdown({ items, totalSpent }) {
  const { t } = useUI();

  if (!items || items.length === 0) {
    return (
      <div className="breakdown-empty">
        <ReceiptText size={18} />
        <div>
          <div className="breakdown-empty-title">{t("nothingHereYet")}</div>
          <div className="breakdown-empty-text">
            {t("expensesWithCategoriesWillBeChartedHere")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="breakdown">
      <div className="breakdown-total">
        <span className="breakdown-total-value">{currencyCompact(totalSpent)}</span>
        <span className="breakdown-total-label">{t("totalSpent")}</span>
      </div>
      <div className="breakdown-list">
        {items.map((b) => {
          const pct = totalSpent
            ? ((Number(b.total_spent) / totalSpent) * 100).toFixed(1)
            : "0";
          return (
            <div key={b.category_name} className="breakdown-row">
              <div className="breakdown-row-head">
                <span className="dash-cat">
                  <span className="dot" style={{ background: b.fill }} />
                  {b.category_name}
                </span>
                <span className="breakdown-row-meta">
                  <span className="breakdown-row-amt">
                    {currencyCompact(b.total_spent)}
                  </span>
                  <span className="breakdown-row-pct">{pct}%</span>
                </span>
              </div>
              <div className="breakdown-track">
                <div
                  className="breakdown-fill"
                  style={{ width: `${Math.min(pct, 100)}%`, background: b.fill }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
