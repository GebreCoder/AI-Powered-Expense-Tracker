import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Banking = lazy(() => import("./pages/Banking"));
const Categories = lazy(() => import("./pages/Categories"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Insights = lazy(() => import("./pages/Insights"));
const SettingsProfile = lazy(() => import("./pages/SettingsProfile"));
const SettingsSecurity = lazy(() => import("./pages/SettingsSecurity"));
const SettingsPreferences = lazy(() => import("./pages/SettingsPreferences"));
const SettingsDataPrivacy = lazy(() => import("./pages/SettingsDataPrivacy"));

function PageFallback() {
  return (
    <div className="auth-spinner-wrap">
      <div className="spinner spinner-lg" />
    </div>
  );
}

function RoutedApp() {
  const location = useLocation();
  return (
    <ErrorBoundary location={location}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/bank" element={<Banking />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
            <Route path="/settings/profile" element={<SettingsProfile />} />
            <Route path="/settings/security" element={<SettingsSecurity />} />
            <Route path="/settings/preferences" element={<SettingsPreferences />} />
            <Route path="/settings/data" element={<SettingsDataPrivacy />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <RoutedApp />
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  );
}
