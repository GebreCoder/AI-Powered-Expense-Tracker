import { useCallback, useEffect, useRef, useState } from "react";
import { History, Search, Send } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

const RECENTS_KEY = "spendwise_recent_searches";
const RECENTS_MAX = 8;

function loadRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter((s) => typeof s === "string" && s.trim())
      : [];
  } catch {
    return [];
  }
}

export default function Insights() {
  const { t } = useUI();
  const { user } = useAuth();
  const firstName = user?.full_name?.trim().split(" ")[0] || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("goodMorning") : hour < 18 ? t("goodAfternoon") : t("goodEvening");
  const [question, setQuestion] = useState("");
  const [lastAsked, setLastAsked] = useState("");
  const [asking, setAsking] = useState(false);
  const [askResult, setAskResult] = useState(null);
  const [askError, setAskError] = useState("");
  const [recents, setRecents] = useState(loadRecents);
  const [recentsOpen, setRecentsOpen] = useState(false);

  const askRequestId = useRef(0);
  const stageRef = useRef(null);

  // Invalidate any in-flight ask when the page unmounts.
  useEffect(() => {
    return () => {
      askRequestId.current += 1;
    };
  }, []);

  // Close the recents panel when clicking outside or pressing Escape.
  useEffect(() => {
    if (!recentsOpen) return;
    const onDown = (e) => {
      if (stageRef.current && !stageRef.current.contains(e.target)) {
        setRecentsOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setRecentsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [recentsOpen]);

  const recordSearch = useCallback((text) => {
    const q = text.trim();
    if (!q) return;
    setRecents((prev) => {
      const next = [
        q,
        ...prev.filter((s) => s.toLowerCase() !== q.toLowerCase()),
      ].slice(0, RECENTS_MAX);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — recents just won't persist */
      }
      return next;
    });
  }, []);

  // ask() keeps the existing AI flow — same endpoint, same response shape.
  const ask = useCallback(
    async (raw) => {
      const q = (raw || "").trim();
      if (!q) {
        setAskError(t("askQuestionRequired"));
        return;
      }
      const id = ++askRequestId.current;
      setQuestion(q);
      setLastAsked(q);
      setAskError("");
      setAskResult(null);
      setRecentsOpen(false);
      setAsking(true);
      recordSearch(q);
      try {
        const result = await api.insights.ask(q);
        if (id !== askRequestId.current) return; // a newer ask superseded this one
        setAskResult(result);
      } catch (err) {
        if (id !== askRequestId.current) return;
        setAskError(err.message || t("askError"));
      } finally {
        if (id === askRequestId.current) setAsking(false);
      }
    },
    [t, recordSearch],
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (question.trim()) ask(question);
  };

  const canAsk = question.trim().length > 0 && !asking;

  return (
    <div className="ai-search">
      <div className="ai-search-hero">
        <h1 className="ai-search-title">
          {greeting}, {firstName || t("there")}
        </h1>
        <p className="ai-search-tagline">{t("askGreetingSub")}</p>
      </div>

      <div className="ai-search-stage" ref={stageRef}>
        <form id="ai-search-form" className="ai-search-box" onSubmit={handleSubmit}>
          <div className="ai-search-field">
            <Search size={19} className="ai-search-icon" aria-hidden="true" />
            <textarea
              className="ai-search-input"
              rows={1}
              placeholder={t("askPlaceholder")}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (question.trim()) ask(question);
                }
              }}
              aria-label={t("aiInsights")}
            />
            <div className="ai-search-actions">
              <button
                type="submit"
                className="icon-btn ai-search-action ai-search-action-primary"
                disabled={!canAsk}
                title={t("searchButton")}
                aria-label={t("searchButton")}
              >
                {asking ? <span className="spinner spinner-sm" /> : <Send size={17} />}
              </button>
              <button
                type="button"
                className="icon-btn ai-search-action"
                onClick={() => setRecentsOpen((o) => !o)}
                aria-expanded={recentsOpen}
                title={t("recentsButton")}
                aria-label={t("recentsButton")}
              >
                <History size={17} />
              </button>
            </div>
          </div>
        </form>

        {recentsOpen && (
          <div className="recents-panel" role="menu" aria-label={t("recentSearches")}>
            <div className="recents-panel-header">{t("recentSearches")}</div>
            {recents.length === 0 ? (
              <div className="recents-empty">
                <p className="recents-empty-title">{t("noRecentSearches")}</p>
                <p className="recents-empty-text">{t("recentSearchesHint")}</p>
              </div>
            ) : (
              <ul className="recents-list">
                {recents.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      className="recents-item"
                      onClick={() => ask(item)}
                      disabled={asking}
                    >
                      <History size={14} className="recents-item-icon" aria-hidden="true" />
                      <span className="recents-item-text">{item}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {askError && <div className="form-error ai-search-error">{askError}</div>}

      {askResult && (
        <div className="ai-thread">
          <div className="ai-thread-user">
            <span className="ai-thread-label">{t("youAsked")}</span>
            <p>{lastAsked}</p>
          </div>
          <div className="ai-thread-answer">
            <span className={`source-badge ${askResult.source === "ai" ? "ai" : "rules"}`}>
              {askResult.source === "ai" ? t("askAiAnswer") : t("askSmartAnswer")}
            </span>
            <p>{askResult.answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
