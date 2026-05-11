import { useState, useEffect } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../../constants/auth_constants";

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchActivities();
  }, [limit]);

  const fetchActivities = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (activities.length === 0) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/admin/activity?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch activity log");
      }

      const data = await response.json();
      setActivities(data.activities);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getActionIcon = (actionType) => {
    const icons = {
      analysis: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      ),
      payment: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
      ),
      login: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
      ),
      batch_analysis: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
      interview_prep: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      ),
    };
    return icons[actionType] || icons.analysis;
  };

  const getActionColor = (actionType) => {
    const colors = {
      analysis: { bg: "rgba(56, 189, 248, 0.2)", color: "#38bdf8" },
      payment: { bg: "rgba(52, 211, 153, 0.2)", color: "#34d399" },
      login: { bg: "rgba(167, 139, 250, 0.2)", color: "#a78bfa" },
      batch_analysis: { bg: "rgba(251, 191, 36, 0.2)", color: "#fbbf24" },
      interview_prep: { bg: "rgba(244, 114, 182, 0.2)", color: "#f472b6" },
    };
    return colors[actionType] || colors.analysis;
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading && activities.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading activity log...</p>
      </div>
    );
  }

  if (error && activities.length === 0) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error}</p>
        <button onClick={() => fetchActivities()} style={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Activity Log</h1>
          <p style={styles.subtitle}>Recent user actions and system events</p>
        </div>
        <div style={styles.controls}>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={styles.select}
          >
            <option value={25}>Last 25</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={200}>Last 200</option>
          </select>
          <button 
            onClick={() => fetchActivities(true)} 
            disabled={refreshing}
            style={{
              ...styles.refreshBtn,
              opacity: refreshing ? 0.7 : 1,
              cursor: refreshing ? "not-allowed" : "pointer",
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Activity Timeline */}
      <div style={styles.timeline}>
        {activities.length > 0 ? (
          activities.map((activity, index) => {
            const actionColor = getActionColor(activity.action_type);
            return (
              <div key={activity.id} style={styles.timelineItem}>
                <div style={styles.timelineLine}>
                  <div
                    style={{
                      ...styles.timelineIcon,
                      backgroundColor: actionColor.bg,
                      color: actionColor.color,
                    }}
                  >
                    {getActionIcon(activity.action_type)}
                  </div>
                  {index < activities.length - 1 && <div style={styles.timelineConnector}></div>}
                </div>
                <div style={styles.timelineContent}>
                  <div style={styles.activityHeader}>
                    <span style={{
                      ...styles.actionType,
                      backgroundColor: actionColor.bg,
                      color: actionColor.color,
                    }}>
                      {activity.action_type.replace(/_/g, " ")}
                    </span>
                    <span style={styles.timeAgo}>{formatTimeAgo(activity.created_at)}</span>
                  </div>
                  <div style={styles.activityUser}>
                    <div style={styles.userAvatar}>
                      {activity.user_name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <span style={styles.userName}>{activity.user_name}</span>
                      <span style={styles.userEmail}>{activity.user_email}</span>
                    </div>
                  </div>
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div style={styles.metadata}>
                      {Object.entries(activity.metadata).map(([key, value]) => (
                        <span key={key} style={styles.metadataItem}>
                          <span style={styles.metadataKey}>{key}:</span>
                          <span style={styles.metadataValue}>
                            {typeof value === "object" ? JSON.stringify(value) : String(value)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div style={styles.noData}>
            <p>No activity recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "900px",
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
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "32px",
    flexWrap: "wrap",
    gap: "16px",
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
  controls: {
    display: "flex",
    gap: "12px",
  },
  select: {
    padding: "10px 16px",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
  },
  refreshBtn: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    color: "#38bdf8",
    border: "1px solid #38bdf8",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
  },
  timelineItem: {
    display: "flex",
    gap: "16px",
  },
  timelineLine: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "40px",
  },
  timelineIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  timelineConnector: {
    width: "2px",
    flex: "1",
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    minHeight: "20px",
  },
  timelineContent: {
    flex: "1",
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    marginBottom: "16px",
  },
  activityHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  actionType: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
    textTransform: "capitalize",
  },
  timeAgo: {
    color: "#64748b",
    fontSize: "12px",
  },
  activityUser: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  userAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    fontSize: "12px",
  },
  userName: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: "500",
    marginRight: "8px",
  },
  userEmail: {
    color: "#64748b",
    fontSize: "12px",
  },
  metadata: {
    marginTop: "12px",
    padding: "12px",
    backgroundColor: "rgba(148, 163, 184, 0.05)",
    borderRadius: "8px",
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  metadataItem: {
    display: "flex",
    gap: "4px",
    fontSize: "12px",
  },
  metadataKey: {
    color: "#64748b",
  },
  metadataValue: {
    color: "#94a3b8",
    fontFamily: "monospace",
  },
  noData: {
    textAlign: "center",
    padding: "60px 20px",
    color: "#64748b",
  },
};

export default ActivityLog;
