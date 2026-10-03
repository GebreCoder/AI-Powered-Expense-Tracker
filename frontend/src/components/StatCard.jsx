import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatCard({
  label,
  value,
  sub,
  tone = "primary",
  delta,
  deltaInvert = false,
  deltaLabel,
}) {
  const tones = {
    primary: "stat-primary",
    income: "stat-income",
    expense: "stat-expense",
  };
  const cls = tones[tone] || tones.primary;
  const hasDelta = delta != null;
  const positive = hasDelta && delta >= 0;
  const good = hasDelta && (deltaInvert ? !positive : positive);

  return (
    <div className={`stat-panel-item ${cls}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-meta">
        {sub && <span className="stat-sub">{sub}</span>}
        {hasDelta && (
          <span className={`stat-delta ${good ? "up" : "down"}`}>
            {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{currencyAbs(delta)}</span>
            {deltaLabel && <span className="stat-delta-label">{deltaLabel}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

function currencyAbs(value) {
  const n = Math.abs(Number(value || 0));
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
