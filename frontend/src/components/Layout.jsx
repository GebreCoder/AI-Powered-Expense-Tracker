import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  CircleDollarSign,
  ChartLine,
  LogOut,
  Menu,
  Settings,
  ChevronDown,
  User,
  Lock,
  Settings2,
  ShieldCheck,
  Landmark,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import Avatar from "./Avatar";
import useBankEvents, { DATA_CHANGED_EVENT } from "../hooks/useBankEvents";

const SETTINGS_SUB = [
  { to: "/settings/profile", label: "myProfile", icon: User },
  { to: "/settings/security", label: "security", icon: Lock },
  { to: "/settings/preferences", label: "preferences", icon: Settings2 },
  { to: "/settings/data", label: "dataAndPrivacy", icon: ShieldCheck },
];

const NAV_SECTIONS = [
  {
    label: "overview",
    items: [{ to: "/", label: "dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "money",
    items: [
      { to: "/transactions", label: "transactions", icon: ArrowLeftRight },
      { to: "/bank", label: "bankAccounts", icon: Landmark },
      { to: "/budgets", label: "budgets", icon: CircleDollarSign },
      { to: "/categories", label: "categories", icon: Tags },
    ],
  },
  {
    label: "intelligence",
    items: [{ to: "/insights", label: "insights", icon: ChartLine }],
  },
  {
    label: "system",
    items: [{ to: "/settings", label: "settings", icon: Settings, sub: SETTINGS_SUB }],
  },
];

const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

function settingsLabelKey(pathname) {
  if (pathname.startsWith("/settings/profile")) return "myProfile";
  if (pathname.startsWith("/settings/security")) return "security";
  if (pathname.startsWith("/settings/preferences")) return "preferences";
  if (pathname.startsWith("/settings/data")) return "dataAndPrivacy";
  return "settings";
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Live bank events (SSE): shows toasts for new bank transactions and
  // dispatches spendwise:data-changed so open pages refresh instantly.
  useBankEvents(true);
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname.startsWith("/settings"),
  );

  // Unseen budget-spend alerts — badge on the Budgets nav item until the
  // user opens the page.
  const [budgetAlertCount, setBudgetAlertCount] = useState(0);

  useEffect(() => {
    const onData = (e) => {
      if (e.detail?.type === "budget.alert") {
        setBudgetAlertCount((n) => n + 1);
      }
    };
    window.addEventListener(DATA_CHANGED_EVENT, onData);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onData);
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith("/budgets")) setBudgetAlertCount(0);
  }, [location.pathname]);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open, and close it on Escape.
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { t } = useUI();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const title = t(
    NAV_ITEMS.find((n) => n.to === location.pathname)?.label ||
      settingsLabelKey(location.pathname),
  );

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/logo.svg" alt="AI Powered Expense Tracker" className="brand-logo-img" />
          <div className="brand-name">AI Powered Expense Tracker</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="nav-section">
              <div className="nav-label">{t(section.label)}</div>
              {section.items.map(({ to, label, icon: Icon, end, sub }) => {
                if (!sub) {
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? "active" : ""}`
                      }
                    >
                      <Icon size={17} strokeWidth={2} />
                      <span>{t(label)}</span>
                      {to === "/budgets" && budgetAlertCount > 0 && (
                        <span className="nav-badge">{budgetAlertCount}</span>
                      )}
                    </NavLink>
                  );
                }
                const isSettingsActive = location.pathname.startsWith("/settings");
                return (
                  <div key={to} className="nav-group">
                    <NavLink
                      to={to}
                      end={end}
                      className={`nav-link ${isSettingsActive ? "active" : ""}`}
                      onClick={(e) => {
                        if (location.pathname.startsWith("/settings")) {
                          e.preventDefault();
                        }
                        setSettingsOpen((v) => !v);
                      }}
                      aria-expanded={settingsOpen}
                    >
                      <Icon size={17} strokeWidth={2} />
                      <span>{t(label)}</span>
                      <ChevronDown
                        size={15}
                        className={`nav-chevron ${settingsOpen ? "open" : ""}`}
                      />
                    </NavLink>
                    {settingsOpen && (
                      <div className="nav-submenu">
                        {sub.map(({ to: subTo, label: subLabel, icon: SubIcon }) => (
                          <NavLink
                            key={subTo}
                            to={subTo}
                            className={({ isActive }) =>
                              `nav-link nav-sub ${isActive ? "active" : ""}`
                            }
                          >
                            <SubIcon size={15} strokeWidth={2} />
                            <span>{t(subLabel)}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <Avatar
              name={user?.full_name}
              image={user?.avatar_image}
              color={user?.avatar_color}
            />
            <div className="user-meta">
              <div className="user-name">{user?.full_name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            <button
              className="icon-btn logout-btn"
              onClick={handleLogout}
              title={t("logOut")}
              aria-label={t("logOut")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {open && <div className="backdrop" onClick={() => setOpen(false)} />}

      <div className="shell-main">
        <header className="topbar">
          <button
            className="icon-btn topbar-menu"
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("openMenu")}
          >
            <Menu size={19} />
          </button>
          <div className="topbar-titles">
            <span className="topbar-title">{title}</span>
            <span className="topbar-date">{today}</span>
          </div>
          <div className="topbar-right">
            <div className="topbar-user" title={user?.email}>
              <Avatar
                name={user?.full_name}
                image={user?.avatar_image}
                color={user?.avatar_color}
                className="topbar-user-avatar"
              />
              <span className="topbar-user-meta">
                <span className="topbar-user-name">{user?.full_name}</span>
                <span className="topbar-user-email">{user?.email}</span>
              </span>
            </div>
            <span className="topbar-divider" aria-hidden="true" />
            <button
              className="icon-btn topbar-logout"
              type="button"
              onClick={handleLogout}
              title={t("logOut")}
              aria-label={t("logOut")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="content">
          <div className="content-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
