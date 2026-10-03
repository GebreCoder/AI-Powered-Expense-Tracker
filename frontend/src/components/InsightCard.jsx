import { FileText, AlertTriangle, PiggyBank, Lightbulb } from "lucide-react";

const TYPE_META = {
  summary: { icon: FileText, cls: "summary" },
  anomaly: { icon: AlertTriangle, cls: "anomaly" },
  budget: { icon: PiggyBank, cls: "budget" },
  tip: { icon: Lightbulb, cls: "tip" },
};

export default function InsightCard({ insight, index = 0, featured = false }) {
  const meta = TYPE_META[insight?.type] || TYPE_META.summary;
  const Icon = meta.icon;
  if (featured) {
    return (
      <div
        className={`insight-card featured tone-${meta.cls}`}
        style={{ animationDelay: `${index * 70}ms` }}
      >
        <div className="insight-icon">
          <Icon size={16} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="insight-title">{insight.title}</div>
          <div className="insight-text">{insight.summary}</div>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`insight-card tone-${meta.cls}`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="insight-icon">
        <Icon size={16} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="insight-title">{insight.title}</div>
        <div className="insight-text">{insight.summary}</div>
      </div>
    </div>
  );
}
