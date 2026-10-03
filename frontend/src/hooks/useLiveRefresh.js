import { useEffect, useRef, useState } from "react";

/**
 * Periodically re-runs `fetchAll` so dashboards stay up to date without
 * a page reload. Polling pauses while the tab is hidden, and it never
 * throws — stale data is kept if a poll fails.
 *
 * Returns `{ lastUpdated, isLive }` so the UI can show a "Live" indicator.
 */
export default function useLiveRefresh(fetchAll, { interval = 30000, enabled = true } = {}) {
  const [lastUpdated, setLastUpdated] = useState(null);
  const fetchRef = useRef(fetchAll);
  fetchRef.current = fetchAll;

  useEffect(() => {
    if (!enabled) return undefined;

    let stopped = false;
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        await fetchRef.current();
        if (!stopped) setLastUpdated(new Date());
      } catch {
        /* keep showing the previous data */
      }
    };

    const id = setInterval(tick, interval);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [interval, enabled]);

  return { lastUpdated, isLive: Boolean(lastUpdated) };
}
