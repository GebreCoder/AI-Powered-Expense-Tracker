import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useUI } from "../context/UIContext";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 520,
}) {
  const { t } = useUI();
  const titleId = useId();
  const panelRef = useRef(null);

  const FOCUSABLE =
    'a[href], button:not([tabindex="-1"]), input:not([tabindex="-1"]), select:not([tabindex="-1"]), textarea:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;

    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        // Keep focus inside the dialog while it is open.
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll(FOCUSABLE);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !panel.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // Move focus into the dialog so keyboard users land on the first
    // interactive control (the close button is tabIndex={-1} and skipped).
    const panel = panelRef.current;
    const focusable = panel?.querySelector(FOCUSABLE);
    (focusable || panel)?.focus?.();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="modal"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label={t("close") || "Close"}
            tabIndex={-1}
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
