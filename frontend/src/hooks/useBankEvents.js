import { useEffect } from "react";
import { API_BASE_URL, getToken } from "../api";
import { useToast } from "../components/Toast";
import { useUI } from "../context/UIContext";
import { currency } from "../utils/format";

// Fired on window whenever bank data changed server-side, so pages can
// silently refresh without polling. Payload is the raw SSE event.
export const DATA_CHANGED_EVENT = "spendwise:data-changed";

export function notifyDataChanged(event) {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: event }));
}

/**
 * Live bank events via Server-Sent Events.
 *
 * Runs inside the authenticated shell (Layout). Opens a fetch-based SSE
 * stream (Bearer token in the header — never in the URL), shows a toast for
 * every newly imported bank transaction, and dispatches
 * `spendwise:data-changed` so open pages refresh instantly.
 *
 * Self-healing: reconnects after the stream drops. No-op when the demo bank
 * feature is disabled on the backend.
 */
export default function useBankEvents(enabled = true) {
  const toast = useToast();
  const { t } = useUI();

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let controller = null;
    let retryTimer = null;
    let buffer = "";

    const handleEvent = (event) => {
      if (!event || !event.type) return;

      if (event.type === "transaction.created") {
        const p = event.payload || {};
        const sign = p.type === "income" ? "+" : "−";
        const line = `${p.description || t("untitled")}\n${sign}${currency(p.amount)}${
          p.category ? ` · ${p.category}` : ""
        }`;
        toast.success(`${t("bankNewTransactionReceived")}\n${line}`);
      }

      if (event.type === "budget.alert") {
        const p = event.payload || {};
        const category = p.categoryName || t("unknown");
        const pct = Math.round(p.pct);
        toast.warning(
          p.level === "over"
            ? t("budgetAlertOver", { category, pct })
            : t("budgetAlertWarn", { category, pct }),
        );
      }

      notifyDataChanged(event);
    };

    const parseChunk = (chunk) => {
      buffer += chunk;
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop();
      for (const block of blocks) {
        const dataLines = block
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim());
        if (dataLines.length === 0) continue;
        try {
          handleEvent(JSON.parse(dataLines.join("\n")));
        } catch {
          /* ignore malformed frames */
        }
      }
    };

    const connect = async () => {
      if (cancelled) return;
      controller = new AbortController();
      try {
        const res = await fetch(`${API_BASE_URL}/bank/events`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parseChunk(decoder.decode(value, { stream: true }));
        }
      } catch {
        /* stream closed or failed — reconnect below */
      }
      if (!cancelled) {
        retryTimer = setTimeout(connect, 5000);
      }
    };

    // Only stream when the backend says the demo bank is enabled.
    const start = async () => {
      try {
        const config = await fetch(`${API_BASE_URL}/bank/config`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }).then((r) => (r.ok ? r.json() : null));
        if (!cancelled && config?.enabled) connect();
      } catch {
        if (!cancelled) connect();
      }
    };
    start();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
    };
  }, [enabled, toast, t]);
}
