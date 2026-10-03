import { useState, useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const [minDelayDone, setMinDelayDone] = useState(false);

  // Show splash for at least 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => setMinDelayDone(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const showSplash = initializing || !minDelayDone;

  if (showSplash) {
    return (
      <div className="auth-spinner-wrap">
        <div style={{ textAlign: "center" }}>
          <img
            src="/splash.svg"
            alt="AI Powered Expense Tracker"
            className="splash-logo"
          />
          <div className="spinner spinner-lg" style={{ margin: "16px auto 0" }} />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
