import { useState, useEffect } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../../constants/auth_constants";

const TokenUsage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchTokenData();
  }, [days]);

  const fetchTokenData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/admin/analytics/tokens?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch token data");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return (num / 1000).toFixed(2) + "K";
    return num.toString();
  };

  if (loading && !data) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading token usage data...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error}</p>
        <button onClick={() => fetchTokenData()} style={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  const maxDailyTokens = Math.max(...(data?.daily_usage?.map(d => d.total_tokens) || [1]));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Token Usage Analytics</h1>
          <p style={styles.subtitle}>Monitor LLM token consumption and costs</p>
        </div>
        <div style={styles.controls}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={styles.select}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button 
            onClick={() => fetchTokenData(true)} 
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

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
              <rect x="9" y="9" width="6" height="6"></rect>
            </svg>
          </div>
          <div style={styles.summaryContent}>
            <span style={styles.summaryLabel}>Total Tokens</span>
            <span style={styles.summaryValue}>{formatNumber(data?.summary?.total_tokens || 0)}</span>
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryIcon, backgroundColor: "rgba(52, 211, 153, 0.2)", color: "#34d399" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div style={styles.summaryContent}>
            <span style={styles.summaryLabel}>Total Cost</span>
            <span style={styles.summaryValue}>${(data?.summary?.total_cost || 0).toFixed(4)}</span>
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryIcon, backgroundColor: "rgba(251, 191, 36, 0.2)", color: "#fbbf24" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div style={styles.summaryContent}>
            <span style={styles.summaryLabel}>Total Requests</span>
            <span style={styles.summaryValue}>{formatNumber(data?.summary?.total_requests || 0)}</span>
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryIcon, backgroundColor: "rgba(167, 139, 250, 0.2)", color: "#a78bfa" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div style={styles.summaryContent}>
            <span style={styles.summaryLabel}>Avg Tokens/Request</span>
            <span style={styles.summaryValue}>
              {data?.summary?.total_requests
                ? Math.round(data.summary.total_tokens / data.summary.total_requests)
                : 0}
            </span>
          </div>
        </div>
      </div>

      {/* Token Breakdown */}
      <div style={styles.breakdownCard}>
        <h3 style={styles.cardTitle}>Token Breakdown</h3>
        <div style={styles.breakdownGrid}>
          <div style={styles.breakdownItem}>
            <span style={styles.breakdownLabel}>Prompt Tokens</span>
            <span style={styles.breakdownValue}>{formatNumber(data?.summary?.prompt_tokens || 0)}</span>
            <div style={styles.breakdownBar}>
              <div style={{
                ...styles.breakdownFill,
                width: data?.summary?.total_tokens 
                  ? `${(data.summary.prompt_tokens / data.summary.total_tokens) * 100}%`
                  : "0%",
                backgroundColor: "#38bdf8",
              }}></div>
            </div>
          </div>
          <div style={styles.breakdownItem}>
            <span style={styles.breakdownLabel}>Completion Tokens</span>
            <span style={styles.breakdownValue}>{formatNumber(data?.summary?.completion_tokens || 0)}</span>
            <div style={styles.breakdownBar}>
              <div style={{
                ...styles.breakdownFill,
                width: data?.summary?.total_tokens 
                  ? `${(data.summary.completion_tokens / data.summary.total_tokens) * 100}%`
                  : "0%",
                backgroundColor: "#34d399",
              }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Usage Chart */}
      <div style={styles.chartCard}>
        <h3 style={styles.cardTitle}>Daily Token Usage</h3>
        <div style={styles.chartContainer}>
          {data?.daily_usage?.length > 0 ? (
            <div style={styles.barChart}>
              {data.daily_usage.map((item, index) => (
                <div key={index} style={styles.barWrapper}>
                  <div style={styles.barTooltip}>
                    <div>{formatNumber(item.total_tokens)}</div>
                    <div style={{ fontSize: "10px", color: "#64748b" }}>${item.cost.toFixed(4)}</div>
                  </div>
                  <div style={styles.stackedBar}>
                    <div
                      style={{
                        ...styles.barSegment,
                        height: `${maxDailyTokens > 0 ? (item.completion_tokens / maxDailyTokens) * 180 : 0}px`,
                        backgroundColor: "#34d399",
                      }}
                    ></div>
                    <div
                      style={{
                        ...styles.barSegment,
                        height: `${maxDailyTokens > 0 ? (item.prompt_tokens / maxDailyTokens) * 180 : 0}px`,
                        backgroundColor: "#38bdf8",
                      }}
                    ></div>
                  </div>
                  <span style={styles.barLabel}>
                    {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.noData}>No usage data available for this period</p>
          )}
        </div>
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: "#38bdf8" }}></div>
            <span>Prompt Tokens</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: "#34d399" }}></div>
            <span>Completion Tokens</span>
          </div>
        </div>
      </div>

      {/* Usage by Endpoint */}
      <div style={styles.tableCard}>
        <h3 style={styles.cardTitle}>Usage by Endpoint</h3>
        {data?.by_endpoint?.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Endpoint</th>
                <th style={styles.th}>Requests</th>
                <th style={styles.th}>Total Tokens</th>
                <th style={styles.th}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.by_endpoint.map((endpoint, index) => (
                <tr key={index}>
                  <td style={styles.td}>
                    <code style={styles.code}>{endpoint.endpoint}</code>
                  </td>
                  <td style={styles.td}>{endpoint.requests}</td>
                  <td style={styles.td}>{formatNumber(endpoint.total_tokens)}</td>
                  <td style={styles.td}>
                    <span style={styles.costBadge}>${endpoint.cost.toFixed(4)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={styles.noData}>No endpoint data available</p>
        )}
      </div>

      {/* Top Users by Token Usage */}
      <div style={styles.tableCard}>
        <h3 style={styles.cardTitle}>Top Users by Token Usage</h3>
        {data?.top_users?.length > 0 ? (
          <div style={styles.usersList}>
            {data.top_users.map((user, index) => (
              <div key={index} style={styles.userCard}>
                <div style={styles.userCardHeader}>
                  <div style={styles.userCell}>
                    <div style={styles.userAvatar}>
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <div style={styles.userName}>{user.name}</div>
                      <div style={styles.userEmail}>{user.email}</div>
                    </div>
                  </div>
                  <div style={styles.userStats}>
                    <div style={styles.userStatItem}>
                      <span style={styles.userStatValue}>{formatNumber(user.total_tokens)}</span>
                      <span style={styles.userStatLabel}>tokens</span>
                    </div>
                    <div style={styles.userStatItem}>
                      <span style={styles.userStatValue}>{user.request_count || 0}</span>
                      <span style={styles.userStatLabel}>requests</span>
                    </div>
                    <div style={styles.userStatItem}>
                      <span style={styles.costBadge}>${user.cost.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
                {user.breakdown && user.breakdown.length > 0 && (
                  <div style={styles.breakdownSection}>
                    <div style={styles.breakdownTitle}>Request Types:</div>
                    <div style={styles.breakdownTags}>
                      {user.breakdown.map((item, idx) => (
                        <div key={idx} style={styles.breakdownTag}>
                          <span style={styles.breakdownEndpoint}>{item.endpoint}</span>
                          <span style={styles.breakdownCount}>{item.count}x</span>
                          <span style={styles.breakdownTokens}>{formatNumber(item.tokens)} tokens</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.noData}>No user data available</p>
        )}
      </div>
    </div>
  );
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
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
    marginBottom: "32px",
  },
  summaryCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  summaryIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    color: "#38bdf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryContent: {
    display: "flex",
    flexDirection: "column",
  },
  summaryLabel: {
    color: "#94a3b8",
    fontSize: "13px",
  },
  summaryValue: {
    color: "#e2e8f0",
    fontSize: "24px",
    fontWeight: "600",
  },
  breakdownCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    marginBottom: "24px",
  },
  cardTitle: {
    color: "#e2e8f0",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0 0 20px 0",
  },
  breakdownGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "24px",
  },
  breakdownItem: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  breakdownLabel: {
    color: "#94a3b8",
    fontSize: "13px",
  },
  breakdownValue: {
    color: "#e2e8f0",
    fontSize: "20px",
    fontWeight: "600",
  },
  breakdownBar: {
    height: "8px",
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    borderRadius: "4px",
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
  chartCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    marginBottom: "24px",
  },
  chartContainer: {
    overflowX: "auto",
  },
  barChart: {
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    minHeight: "280px",
    paddingTop: "50px",
  },
  barWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: "1",
    minWidth: "50px",
    position: "relative",
  },
  barTooltip: {
    position: "absolute",
    top: "-45px",
    color: "#94a3b8",
    fontSize: "11px",
    textAlign: "center",
  },
  stackedBar: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: "40px",
    borderRadius: "4px 4px 0 0",
    overflow: "hidden",
  },
  barSegment: {
    width: "100%",
    transition: "height 0.3s ease",
  },
  barLabel: {
    marginTop: "8px",
    color: "#64748b",
    fontSize: "10px",
    textAlign: "center",
  },
  legend: {
    display: "flex",
    justifyContent: "center",
    gap: "24px",
    marginTop: "16px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#94a3b8",
    fontSize: "12px",
  },
  legendDot: {
    width: "12px",
    height: "12px",
    borderRadius: "3px",
  },
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    marginBottom: "24px",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
  },
  td: {
    padding: "12px 16px",
    color: "#e2e8f0",
    fontSize: "14px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.05)",
  },
  code: {
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "13px",
    fontFamily: "monospace",
  },
  costBadge: {
    backgroundColor: "rgba(52, 211, 153, 0.2)",
    color: "#34d399",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "500",
  },
  userCell: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  userAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    color: "#38bdf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    fontSize: "14px",
  },
  userName: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: "500",
  },
  userEmail: {
    color: "#64748b",
    fontSize: "12px",
  },
  noData: {
    color: "#64748b",
    textAlign: "center",
    padding: "40px",
  },
  usersList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  userCard: {
    backgroundColor: "rgba(148, 163, 184, 0.05)",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
  },
  userCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
  },
  userStats: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
  },
  userStatItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
  },
  userStatValue: {
    color: "#e2e8f0",
    fontSize: "18px",
    fontWeight: "600",
  },
  userStatLabel: {
    color: "#64748b",
    fontSize: "11px",
    textTransform: "uppercase",
  },
  breakdownSection: {
    marginTop: "16px",
    paddingTop: "16px",
    borderTop: "1px solid rgba(148, 163, 184, 0.1)",
  },
  breakdownTitle: {
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "10px",
    textTransform: "uppercase",
  },
  breakdownTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  breakdownTag: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "13px",
  },
  breakdownEndpoint: {
    color: "#e2e8f0",
    fontWeight: "500",
  },
  breakdownCount: {
    color: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: "600",
  },
  breakdownTokens: {
    color: "#64748b",
    fontSize: "12px",
  },
};

export default TokenUsage;
