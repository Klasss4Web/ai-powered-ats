import { useState, useEffect } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../../constants/auth_constants";

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    setError(null);
    
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard stats");
      }

      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error}</p>
        <button onClick={fetchDashboardStats} style={styles.retryBtn}>
          Retry
        </button>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats?.users?.total || 0,
      subtitle: `+${stats?.users?.new_today || 0} today`,
      icon: "users",
      color: "#38bdf8",
    },
    {
      title: "Premium Users",
      value: stats?.users?.by_subscription?.premium || 0,
      subtitle: `${Math.round(((stats?.users?.by_subscription?.premium || 0) / (stats?.users?.total || 1)) * 100)}% of total`,
      icon: "star",
      color: "#fbbf24",
    },
    {
      title: "Analyses Today",
      value: stats?.analyses?.today || 0,
      subtitle: `${stats?.analyses?.this_week || 0} this week`,
      icon: "file-text",
      color: "#34d399",
    },
    {
      title: "Total Analyses",
      value: stats?.analyses?.total || 0,
      subtitle: "All time",
      icon: "bar-chart",
      color: "#a78bfa",
    },
    {
      title: "API Requests (24h)",
      value: stats?.api?.requests_24h || 0,
      subtitle: `${stats?.api?.errors_24h || 0} errors`,
      icon: "activity",
      color: "#f472b6",
    },
    {
      title: "Avg Response Time",
      value: `${stats?.api?.avg_response_time_ms || 0}ms`,
      subtitle: "Last 24 hours",
      icon: "clock",
      color: "#fb923c",
    },
    {
      title: "Tokens Used Today",
      value: formatNumber(stats?.tokens?.used_today || 0),
      subtitle: `$${(stats?.tokens?.cost_today || 0).toFixed(4)} cost`,
      icon: "cpu",
      color: "#22d3ee",
    },
    {
      title: "New Users (Week)",
      value: stats?.users?.new_this_week || 0,
      subtitle: "Last 7 days",
      icon: "user-plus",
      color: "#818cf8",
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Dashboard Overview</h1>
        <p style={styles.subtitle}>Welcome back! Here's what's happening with your app.</p>
      </div>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        {statCards.map((card, index) => (
          <div key={index} style={styles.statCard}>
            <div style={styles.statCardHeader}>
              <div style={{ ...styles.statIcon, backgroundColor: `${card.color}20`, color: card.color }}>
                {getIcon(card.icon)}
              </div>
              <span style={styles.statTitle}>{card.title}</span>
            </div>
            <div style={styles.statValue}>{card.value}</div>
            <div style={styles.statSubtitle}>{card.subtitle}</div>
          </div>
        ))}
      </div>

      {/* Quick Stats Row */}
      <div style={styles.quickStatsRow}>
        <div style={styles.quickStatCard}>
          <h3 style={styles.quickStatTitle}>User Distribution</h3>
          <div style={styles.distributionBars}>
            <div style={styles.distributionItem}>
              <div style={styles.distributionLabel}>
                <span>Free Users</span>
                <span>{stats?.users?.by_subscription?.free || 0}</span>
              </div>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${((stats?.users?.by_subscription?.free || 0) / (stats?.users?.total || 1)) * 100}%`,
                    backgroundColor: "#64748b",
                  }}
                ></div>
              </div>
            </div>
            <div style={styles.distributionItem}>
              <div style={styles.distributionLabel}>
                <span>Premium Users</span>
                <span>{stats?.users?.by_subscription?.premium || 0}</span>
              </div>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${((stats?.users?.by_subscription?.premium || 0) / (stats?.users?.total || 1)) * 100}%`,
                    backgroundColor: "#fbbf24",
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.quickStatCard}>
          <h3 style={styles.quickStatTitle}>API Health</h3>
          <div style={styles.healthGrid}>
            <div style={styles.healthItem}>
              <span style={styles.healthLabel}>Error Rate</span>
              <span style={{
                ...styles.healthValue,
                color: (stats?.api?.errors_24h || 0) / (stats?.api?.requests_24h || 1) > 0.05 ? "#ef4444" : "#34d399"
              }}>
                {stats?.api?.requests_24h
                  ? (((stats?.api?.errors_24h || 0) / stats.api.requests_24h) * 100).toFixed(2)
                  : 0}%
              </span>
            </div>
            <div style={styles.healthItem}>
              <span style={styles.healthLabel}>Uptime</span>
              <span style={{ ...styles.healthValue, color: "#34d399" }}>99.9%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div style={styles.refreshContainer}>
        <button 
          onClick={() => fetchDashboardStats(true)} 
          disabled={refreshing}
          style={{
            ...styles.refreshBtn,
            opacity: refreshing ? 0.7 : 1,
            cursor: refreshing ? "not-allowed" : "pointer",
          }}
        >
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
        <span style={styles.lastUpdated}>
          Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "Never"}
        </span>
      </div>
    </div>
  );
};

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

const getIcon = (iconName) => {
  const icons = {
    users: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
    star: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    ),
    "file-text": (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    ),
    "bar-chart": (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="20" x2="12" y2="10"></line>
        <line x1="18" y1="20" x2="18" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="16"></line>
      </svg>
    ),
    activity: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
    ),
    clock: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    ),
    cpu: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
        <rect x="9" y="9" width="6" height="6"></rect>
        <line x1="9" y1="1" x2="9" y2="4"></line>
        <line x1="15" y1="1" x2="15" y2="4"></line>
        <line x1="9" y1="20" x2="9" y2="23"></line>
        <line x1="15" y1="20" x2="15" y2="23"></line>
      </svg>
    ),
    "user-plus": (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="20" y1="8" x2="20" y2="14"></line>
        <line x1="23" y1="11" x2="17" y2="11"></line>
      </svg>
    ),
  };
  return icons[iconName] || icons.activity;
};

const styles = {
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    color: "#94a3b8",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(56, 189, 248, 0.3)",
    borderTopColor: "#38bdf8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "16px",
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
  },
  errorText: {
    color: "#ef4444",
    marginBottom: "16px",
  },
  retryBtn: {
    padding: "10px 20px",
    backgroundColor: "#38bdf8",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  header: {
    marginBottom: "32px",
  },
  title: {
    color: "#e2e8f0",
    fontSize: "28px",
    fontWeight: "600",
    margin: 0,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    marginTop: "8px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
    marginBottom: "32px",
  },
  statCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
  },
  statCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  statIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statTitle: {
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: "500",
  },
  statValue: {
    color: "#e2e8f0",
    fontSize: "28px",
    fontWeight: "600",
    marginBottom: "4px",
  },
  statSubtitle: {
    color: "#64748b",
    fontSize: "12px",
  },
  quickStatsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    marginBottom: "32px",
  },
  quickStatCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
  },
  quickStatTitle: {
    color: "#e2e8f0",
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "20px",
    margin: "0 0 20px 0",
  },
  distributionBars: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  distributionItem: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  distributionLabel: {
    display: "flex",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: "13px",
  },
  progressBar: {
    height: "8px",
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    borderRadius: "4px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
  healthGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },
  healthItem: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  healthLabel: {
    color: "#94a3b8",
    fontSize: "13px",
  },
  healthValue: {
    fontSize: "24px",
    fontWeight: "600",
  },
  refreshContainer: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  refreshBtn: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    color: "#38bdf8",
    border: "1px solid #38bdf8",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s ease",
  },
  lastUpdated: {
    color: "#64748b",
    fontSize: "12px",
  },
};

export default AdminDashboard;
