import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useUI } from "../context/UIContext";

// Catches render errors in any page so the user never sees a blank screen.
// Shows a friendly message with a reload button instead.

function ErrorContent({ onReload }) {
  const { t } = useUI();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: 420,
          background: "var(--bg-soft)",
          border: "1px solid var(--border, rgba(148,163,184,.15))",
          borderRadius: 16,
          padding: "36px 32px",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 16px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--danger) 14%, transparent)",
            color: "var(--danger)",
          }}
        >
          <AlertTriangle size={26} />
        </div>
        <h2 style={{ margin: "0 0 8px", color: "var(--text-primary)" }}>
          {t("errorBoundaryTitle")}
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--text-muted)",
          }}
        >
          {t("errorBoundaryText")}
        </p>
        <button
          className="btn btn-primary"
          onClick={onReload}
          type="button"
        >
          <RefreshCw size={15} />
          {t("reloadPage")}
        </button>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, prevLocation: props.location };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    // Navigating away from the crashed route clears the error so the
    // boundary can retry the next page without a full reload.
    if (state.error && props.location !== state.prevLocation) {
      return { error: null, prevLocation: props.location };
    }
    return null;
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => {
    // Reset state first, then reload the page for a clean slate.
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorContent onReload={this.handleReload} />;
  }
}
