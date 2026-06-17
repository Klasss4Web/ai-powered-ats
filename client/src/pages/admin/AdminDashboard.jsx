import { useState, useEffect } from "react";
import { BASE_URL } from "../../constants/auth_constants";
import fetchWithTimeout from "../../configs/fetch";
import "./AdminDashboard.css";

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 1 year", days: 365 },
];

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [filters, setFilters] = useState({ preset: "7", startDate: "", endDate: "" });
  const { preset, startDate, endDate } = filters;
  const updateFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (startDate && endDate) {
      params.append("start_date", startDate);
      params.append("end_date", endDate);
    } else {
      params.append("days", preset);
    }
    return `${BASE_URL}/admin/dashboard?${params.toString()}`;
  };

  const fetchDashboardStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetchWithTimeout(buildUrl());
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
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

  useEffect(() => {
    fetchDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, startDate, endDate]);

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-loading">
        <p className="admin-error-text">{error}</p>
        <button onClick={fetchDashboardStats} className="admin-retry-btn">Retry</button>
      </div>
    );
  }

  const periodLabel = startDate && endDate
    ? `${startDate} → ${endDate}`
    : PRESETS.find((p) => String(p.days) === preset)?.label || "Custom";

  const statCards = [
    {
      title: "Total Users",
      value: stats?.users?.total || 0,
      subtitle: `+${stats?.users?.new_in_period || 0} in period`,
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
      title: `Analyses (${periodLabel})`,
      value: stats?.analyses?.period || 0,
      subtitle: `${stats?.analyses?.total || 0} all time`,
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
      title: `API Requests (${periodLabel})`,
      value: stats?.api?.requests_period || 0,
      subtitle: `${stats?.api?.errors_period || 0} errors`,
      icon: "activity",
      color: "#f472b6",
    },
    {
      title: "Avg Response Time",
      value: `${stats?.api?.avg_response_time_ms || 0}ms`,
      subtitle: "In selected period",
      icon: "clock",
      color: "#fb923c",
    },
    {
      title: `Tokens Used (${periodLabel})`,
      value: formatNumber(stats?.tokens?.used_period || 0),
      subtitle: `$${(stats?.tokens?.cost_period || 0).toFixed(4)} cost`,
      icon: "cpu",
      color: "#22d3ee",
    },
    {
      title: `New Users (${periodLabel})`,
      value: stats?.users?.new_in_period || 0,
      subtitle: "In selected period",
      icon: "user-plus",
      color: "#818cf8",
    },
  ];

  return (
    <div className="admin-container">
      <div className="admin-header-row">
        <div>
          <h1 className="admin-title">Dashboard Overview</h1>
          <p className="admin-subtitle">Welcome back! Here's what's happening with your app.</p>
        </div>
        <div className="admin-controls">
          <select
            value={preset}
            onChange={(e) => {
              updateFilter("preset", e.target.value);
              updateFilter("startDate", "");
              updateFilter("endDate", "");
            }}
            className="admin-select"
          >
            {PRESETS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
          <span style={{ color: "#64748b", fontSize: "13px" }}>or</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => updateFilter("startDate", e.target.value)}
            className="admin-date-input"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => updateFilter("endDate", e.target.value)}
            className="admin-date-input"
          />
          <button
            onClick={() => fetchDashboardStats(true)}
            disabled={refreshing}
            className="admin-refresh-btn"
            style={{ opacity: refreshing ? 0.7 : 1 }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="admin-stats-grid">
        {statCards.map((card, index) => (
          <div key={index} className="admin-stat-card">
            <div className="admin-stat-card-header">
              <div className="admin-stat-icon" style={{ backgroundColor: `${card.color}20`, color: card.color }}>
                {getIcon(card.icon)}
              </div>
              <span className="admin-stat-title">{card.title}</span>
            </div>
            <div className="admin-stat-value">{card.value}</div>
            <div className="admin-stat-subtitle">{card.subtitle}</div>
          </div>
        ))}
      </div>

      <div className="admin-quick-row">
        <div className="admin-quick-card">
          <h3 className="admin-quick-title">User Distribution</h3>
          <div className="admin-distribution-list">
            <div className="admin-distribution-item">
              <div className="admin-distribution-label">
                <span>Free Users</span>
                <span>{stats?.users?.by_subscription?.free || 0}</span>
              </div>
              <div className="admin-progress-bar">
                <div
                  className="admin-progress-fill"
                  style={{
                    width: `${((stats?.users?.by_subscription?.free || 0) / (stats?.users?.total || 1)) * 100}%`,
                    backgroundColor: "#64748b",
                  }}
                ></div>
              </div>
            </div>
            <div className="admin-distribution-item">
              <div className="admin-distribution-label">
                <span>Premium Users</span>
                <span>{stats?.users?.by_subscription?.premium || 0}</span>
              </div>
              <div className="admin-progress-bar">
                <div
                  className="admin-progress-fill"
                  style={{
                    width: `${((stats?.users?.by_subscription?.premium || 0) / (stats?.users?.total || 1)) * 100}%`,
                    backgroundColor: "#fbbf24",
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-quick-card">
          <h3 className="admin-quick-title">API Health</h3>
          <div className="admin-health-grid">
            <div className="admin-health-item">
              <span className="admin-health-label">Error Rate</span>
              <span
                className="admin-health-value"
                style={{
                  color: (stats?.api?.errors_period || 0) / (stats?.api?.requests_period || 1) > 0.05 ? "#ef4444" : "#34d399",
                }}
              >
                {stats?.api?.requests_period
                  ? (((stats?.api?.errors_period || 0) / stats.api.requests_period) * 100).toFixed(2)
                  : 0}%
              </span>
            </div>
            <div className="admin-health-item">
              <span className="admin-health-label">Uptime</span>
              <span className="admin-health-value" style={{ color: "#34d399" }}>99.9%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-refresh-row">
        <span className="admin-last-updated">
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

export default AdminDashboard;
