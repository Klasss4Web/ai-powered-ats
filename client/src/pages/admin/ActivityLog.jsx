import { useState, useEffect, useCallback } from "react";
import { AUTH_CONSTANTS } from "../../constants/auth_constants";
import fetchWithTimeout from "../../configs/fetch";

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const fetchActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (activities.length === 0) setLoading(true);
    setError(null);

    try {
      const response = await fetchWithTimeout(`/admin/activity?page=${page}&per_page=${perPage}`);
      if (!response.ok) throw new Error("Failed to fetch activity log");

      const data = await response.json();
      setActivities(data.activities || []);
      setPagination(data.pagination || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, perPage]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

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
      cover_letter: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
      ),
      interview_prep: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      ),
      subscription_upgrade: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
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
      cover_letter: { bg: "rgba(139, 92, 246, 0.2)", color: "#a78bfa" },
      subscription_upgrade: { bg: "rgba(251, 191, 36, 0.2)", color: "#fbbf24" },
    };
    return colors[actionType] || colors.analysis;
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading && activities.length === 0) {
    return (
      <div style={st.center}>
        <div style={st.spinner} />
        <p style={{ color: "#94a3b8" }}>Loading activity log…</p>
      </div>
    );
  }

  if (error && activities.length === 0) {
    return (
      <div style={st.center}>
        <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>
        <button onClick={() => fetchActivities()} style={st.btnFilled}>Retry</button>
      </div>
    );
  }

  const totalPages = pagination.pages || 1;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Activity Log</h1>
          <p style={st.subtitle}>
            {pagination.total || 0} total actions · Recent user actions and system events
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => fetchActivities(true)} disabled={refreshing} style={st.btnOutline}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div style={st.timeline}>
        {activities.length > 0 ? (
          activities.map((activity, index) => {
            const actionColor = getActionColor(activity.action_type);
            return (
              <div key={activity.id} style={st.timelineItem}>
                <div style={st.timelineLine}>
                  <div style={{ ...st.timelineIcon, backgroundColor: actionColor.bg, color: actionColor.color }}>
                    {getActionIcon(activity.action_type)}
                  </div>
                  {index < activities.length - 1 && <div style={st.timelineConnector}></div>}
                </div>
                <div style={st.timelineContent}>
                  <div style={st.activityHeader}>
                    <span style={{ ...st.actionType, backgroundColor: actionColor.bg, color: actionColor.color }}>
                      {activity.action_type.replace(/_/g, " ")}
                    </span>
                    <span style={st.timeAgo}>{formatTimeAgo(activity.created_at)}</span>
                  </div>
                  <div style={st.activityUser}>
                    <div style={st.userAvatar}>
                      {activity.user_name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <span style={st.userName}>{activity.user_name}</span>
                      <span style={st.userEmail}>{activity.user_email}</span>
                    </div>
                  </div>
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div style={st.metadata}>
                      {Object.entries(activity.metadata).map(([key, value]) => (
                        <span key={key} style={st.metadataItem}>
                          <span style={st.metadataKey}>{key}:</span>
                          <span style={st.metadataValue}>
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
          <div style={st.noData}>
            <p>No activity recorded yet</p>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {pagination.total > 0 && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>
              Showing <strong style={{ color: "#e2e8f0" }}>{(page - 1) * perPage + 1}</strong> –{" "}
              <strong style={{ color: "#e2e8f0" }}>{Math.min(page * perPage, pagination.total)}</strong> of{" "}
              <strong style={{ color: "#e2e8f0" }}>{pagination.total}</strong> actions
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>Rows:</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                style={{ ...st.select, padding: "6px 10px", fontSize: 12 }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <PageBtn label="First" onClick={() => setPage(1)} disabled={page === 1} />
              <PageBtn label="Prev" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} />

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`gap-${i}`} style={{ color: "#64748b", fontSize: 13, padding: "0 4px" }}>…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        minWidth: 32,
                        height: 32,
                        padding: "0 8px",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: page === p ? "#38bdf8" : "rgba(148,163,184,0.1)",
                        color: page === p ? "#0f172a" : "#cbd5e1",
                      }}
                    >
                      {p}
                    </button>
                  ),
                )}

              <PageBtn label="Next" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} />
              <PageBtn label="Last" onClick={() => setPage(totalPages)} disabled={page === totalPages} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── tiny components ───────────────────────────────────────── */
const PageBtn = ({ label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "6px 12px",
      borderRadius: 6,
      border: "1px solid rgba(148,163,184,0.2)",
      background: disabled ? "rgba(148,163,184,0.05)" : "rgba(148,163,184,0.1)",
      color: disabled ? "#475569" : "#cbd5e1",
      fontSize: 13,
      cursor: disabled ? "not-allowed" : "pointer",
    }}
  >
    {label}
  </button>
);

/* ─── styles ────────────────────────────────────────────────── */
const st = {
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 400,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid rgba(56,189,248,0.3)",
    borderTopColor: "#38bdf8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
    flexWrap: "wrap",
    gap: 16,
  },
  title: {
    color: "#e2e8f0",
    fontSize: 28,
    fontWeight: 600,
    margin: "0 0 8px",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    margin: 0,
  },
  btnOutline: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    color: "#38bdf8",
    border: "1px solid #38bdf8",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  btnFilled: {
    padding: "10px 20px",
    backgroundColor: "#38bdf8",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  select: {
    padding: "10px 14px",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
  },
  timelineItem: {
    display: "flex",
    gap: 16,
  },
  timelineLine: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: 40,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    minHeight: 20,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    border: "1px solid rgba(148, 163, 184, 0.1)",
    marginBottom: 16,
  },
  activityHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  actionType: {
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    textTransform: "capitalize",
  },
  timeAgo: {
    color: "#64748b",
    fontSize: 12,
  },
  activityUser: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: 12,
  },
  userName: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 500,
    marginRight: 8,
  },
  userEmail: {
    color: "#64748b",
    fontSize: 12,
  },
  metadata: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(148, 163, 184, 0.05)",
    borderRadius: 8,
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  metadataItem: {
    display: "flex",
    gap: 4,
    fontSize: 12,
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
