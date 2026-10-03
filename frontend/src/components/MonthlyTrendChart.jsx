import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ArrowLeftRight } from "lucide-react";
import EmptyState from "./EmptyState";
import { useUI } from "../context/UIContext";
import { currency, currencyCompact, monthLabel } from "../utils/format";

// Reads a CSS custom property from :root so chart colors follow the theme.
function useCssVar(name, fallback) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const update = () =>
      setValue(
        getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim() || fallback,
      );
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [name, fallback]);
  return value;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{monthLabel(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tooltip-row">
          <span className="dot" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{currency(Number(p.value))}</strong>
        </div>
      ))}
    </div>
  );
}

export default function MonthlyTrendChart({ trend, compact = false }) {
  const { t } = useUI();
  const incomeColor = useCssVar("--income", "#34d399");
  const expenseColor = useCssVar("--expense", "#f87171");

  const chartHeight = compact ? 220 : 290;
  const notEnoughData = trend.length > 0 && trend.length < 2;

  return (
    <div className={`trend-chart ${compact ? "compact" : "card"}`}>
      <div className="trend-legend">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            className="dot"
            style={{ width: 9, height: 9, borderRadius: 3, background: incomeColor }}
          />
          {t("income")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            className="dot"
            style={{ width: 9, height: 9, borderRadius: 3, background: expenseColor }}
          />
          {t("expenses")}
        </span>
      </div>
      {trend.length === 0 ? (
        <div className="trend-empty">
          <ArrowLeftRight size={18} />
          <div>
            <div className="trend-empty-title">{t("noMonthlyDataYet")}</div>
            <div className="trend-empty-text">{t("noMonthlyDataYetText")}</div>
          </div>
        </div>
      ) : notEnoughData ? (
        <div className="trend-empty">
          <ArrowLeftRight size={18} />
          <div>
            <div className="trend-empty-title">{t("notEnoughData")}</div>
            <div className="trend-empty-text">{t("notEnoughDataText")}</div>
          </div>
        </div>
      ) : (
        <div className={compact ? "trend-chart-body" : "trend-chart-body padded"}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={trend} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={incomeColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={incomeColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={expenseColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={expenseColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                stroke="#8a94a0"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                dy={6}
              />
              <YAxis
                stroke="#8a94a0"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => currencyCompact(v)}
                width={58}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(148, 163, 184, 0.35)" }} />
              <Area
                type="monotone"
                dataKey="income"
                stroke={incomeColor}
                strokeWidth={2.5}
                fill="url(#gIncome)"
                name={t("income")}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke={expenseColor}
                strokeWidth={2.5}
                fill="url(#gExpense)"
                name={t("expenses")}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
