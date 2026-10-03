/* eslint-disable react-refresh/only-export-components -- context, provider
   and hook are intentionally colocated in one module. */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "success") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list, { id, message, type }]);
      setTimeout(() => dismiss(id), 3600);
    },
    [dismiss],
  );

  const success = useCallback((m) => push(m, "success"), [push]);
  const error = useCallback((m) => push(m, "error"), [push]);
  const warning = useCallback((m) => push(m, "warning"), [push]);

  const value = useMemo(() => ({ success, error, warning }), [success, error, warning]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-icon">
              {t.type === "success" ? (
                <CheckCircle2 size={16} />
              ) : t.type === "warning" ? (
                <AlertTriangle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
            </span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button className="icon-btn" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
