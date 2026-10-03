// Bank-style money display: the amount is masked by default (like a password
// field) and its own eye icon sits directly in front of it. Click the eye to
// reveal just this amount; click again to hide it.
//
// The amount keeps a fixed width, so revealing/hiding never shifts the
// layout — the eye stays in its correct position in front of the money.

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useUI } from "../context/UIContext";
import { currency } from "../utils/format";

export const AMOUNT_MASK = "••••••";

export default function MaskedAmount({ value, className = "" }) {
  const { t } = useUI();
  const [revealed, setRevealed] = useState(false);

  return (
    <span className={`masked-amount ${className}`}>
      <button
        type="button"
        className="eye-btn"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? t("hideAmounts") : t("showAmounts")}
        title={revealed ? t("hideAmounts") : t("showAmounts")}
      >
        {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <span className={revealed ? "amount-value" : "amount-masked"}>
        {revealed ? currency(value) : AMOUNT_MASK}
      </span>
    </span>
  );
}
