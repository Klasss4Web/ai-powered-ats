import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import ConfirmModal from "../../components/ConfirmModal";

const AdminLayout = () => {
  const navigate = useNavigate();
  const { user, logout, isLoading: authLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  /* ── redirect non-admins ── */
  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    navigate("/");
  };

  if (authLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Verifying admin access...</p>
      </div>
    );
  }

  const menuItems = [
    {
      section: "Overview",
      items: [{ path: "/admin", label: "Dashboard", icon: "grid" }],
    },
    {
      section: "Analytics",
      items: [
        {
          path: "/admin/traffic",
          label: "Traffic & Usage",
          icon: "trending-up",
        },
        { path: "/admin/tokens", label: "Token Usage", icon: "cpu" },
        { path: "/admin/performance", label: "Performance", icon: "activity" },
      ],
    },
    {
      section: "Management",
      items: [
        { path: "/admin/users", label: "Users", icon: "users" },
        {
          path: "/admin/subscriptions",
          label: "Subscriptions",
          icon: "credit-card",
        },
        {
          path: "/admin/feature-flags",
          label: "Feature Flags",
          icon: "toggle",
        },
        { path: "/admin/activity", label: "Activity Log", icon: "list" },
        { path: "/admin/errors", label: "Error Log", icon: "alert" },
      ],
    },
  ];

  const getIcon = (iconName) => {
    const icons = {
      grid: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
      "trending-up": (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
      ),
      cpu: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
          <rect x="9" y="9" width="6" height="6"></rect>
          <line x1="9" y1="1" x2="9" y2="4"></line>
          <line x1="15" y1="1" x2="15" y2="4"></line>
          <line x1="9" y1="20" x2="9" y2="23"></line>
          <line x1="15" y1="20" x2="15" y2="23"></line>
          <line x1="20" y1="9" x2="23" y2="9"></line>
          <line x1="20" y1="14" x2="23" y2="14"></line>
          <line x1="1" y1="9" x2="4" y2="9"></line>
          <line x1="1" y1="14" x2="4" y2="14"></line>
        </svg>
      ),
      activity: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
      users: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
      list: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
      ),
      alert: (
        <svg
          width="18"
          height="18"
          viewBox="[PHONE NUMBER_REDACTED]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M10.29 3.86L1.82 18a2 2 [PHONE NUMBER_REDACTED]h16.94a2 2 [PHONE NUMBER_REDACTED]L13.71 3.86a2 2 [PHONE NUMBER_REDACTED]z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      ),
      toggle: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="1" y="5" width="22" height="14" rx="7" ry="7"></rect>
          <circle cx="8" cy="12" r="3"></circle>
        </svg>
      ),
      "credit-card": (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
      ),
    };
    return icons[iconName] || icons.grid;
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside
        style={{
          ...styles.sidebar,
          width: sidebarCollapsed ? "60px" : "260px",
        }}
      >
        <div style={styles.sidebarHeader}>
          <div style={styles.logoContainer}>
            <span style={styles.logoIcon}>A</span>
            {!sidebarCollapsed && (
              <span style={styles.logoText}>Admin Panel</span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={styles.collapseBtn}
          >
            {sidebarCollapsed ? ">" : "<"}
          </button>
        </div>

        <nav style={styles.nav}>
          {menuItems.map((section, sIdx) => (
            <div key={sIdx} style={styles.navSection}>
              {!sidebarCollapsed && (
                <span style={styles.sectionLabel}>{section.section}</span>
              )}
              {section.items.map((item, iIdx) => (
                <NavLink
                  key={iIdx}
                  to={item.path}
                  end={item.path === "/admin"}
                  style={({ isActive }) => ({
                    ...styles.navLink,
                    ...(isActive ? styles.navLinkActive : {}),
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  })}
                >
                  <span style={styles.navIcon}>{getIcon(item.icon)}</span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User info at bottom */}
        {!sidebarCollapsed && user && (
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>
              {user.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div style={styles.userDetails}>
              <span style={styles.userName}>{user.name}</span>
              <span style={styles.userRole}>Administrator</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main
        style={{
          ...styles.main,
          marginLeft: sidebarCollapsed ? "60px" : "260px",
        }}
      >
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <NavLink to="/" style={styles.backLink}>
              Back to App
            </NavLink>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.adminBadge}>Admin</span>
            <button onClick={handleLogout} style={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </header>
        <div style={styles.content}>
          <Outlet />
        </div>
      </main>
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Logout?"
        message="You are about to log out of the admin panel."
        confirmText="Logout"
        confirmColor="#ef4444"
        cancelText="Cancel"
      />
    </div>
  );
};

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(56, 189, 248, 0.3)",
    borderTopColor: "#38bdf8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  sidebar: {
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
    backgroundColor: "#1e293b",
    borderRight: "1px solid rgba(148, 163, 184, 0.1)",
    transition: "width 0.3s ease",
    display: "flex",
    flexDirection: "column",
    zIndex: 100,
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 16px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
  },
  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  logoIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #38bdf8, #8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "16px",
  },
  logoText: {
    color: "#e2e8f0",
    fontWeight: "600",
    fontSize: "16px",
  },
  collapseBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: "16px",
    padding: "4px 8px",
  },
  nav: {
    flex: 1,
    padding: "16px 12px",
    overflowY: "auto",
  },
  navSection: {
    marginBottom: "24px",
  },
  sectionLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "0 12px",
    marginBottom: "8px",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: "14px",
    transition: "all 0.2s ease",
    marginBottom: "4px",
  },
  navLinkActive: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    color: "#38bdf8",
  },
  navIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    borderTop: "1px solid rgba(148, 163, 184, 0.1)",
  },
  userAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #38bdf8, #8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "14px",
  },
  userDetails: {
    display: "flex",
    flexDirection: "column",
  },
  userName: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: "500",
  },
  userRole: {
    color: "#64748b",
    fontSize: "12px",
  },
  main: {
    minHeight: "100vh",
    transition: "margin-left 0.3s ease",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    backgroundColor: "#1e293b",
    borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  backLink: {
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 12px",
    borderRadius: "6px",
    transition: "all 0.2s ease",
  },
  adminBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    color: "#a78bfa",
    fontSize: "12px",
    fontWeight: "500",
  },
  content: {
    // padding: "32px 40px",
    // maxWidth: "calc(100vw - 340px)",
    padding: "2rem",
    minWidth: 0,
    dispay: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  logoutBtn: {
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#fca5a5",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
};

export default AdminLayout;
