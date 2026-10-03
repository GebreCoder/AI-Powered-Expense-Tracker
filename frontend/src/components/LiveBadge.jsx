import { Radio } from "lucide-react";
import { useUI } from "../context/UIContext";
import { formatTime } from "../utils/format";

export default function LiveBadge({ lastUpdated }) {
  const { t } = useUI();
  const on = Boolean(lastUpdated);
  return (
    <span className={`live-badge ${on ? "on" : ""}`} title={on ? t("liveUpdatedAt", { time: formatTime(lastUpdated) }) : t("live")}>
      <Radio size={12} className="live-icon" />
      <span className="live-text">
        {t("live")}
        {on && <span className="live-time"> · {formatTime(lastUpdated)}</span>}
      </span>
    </span>
  );
}
